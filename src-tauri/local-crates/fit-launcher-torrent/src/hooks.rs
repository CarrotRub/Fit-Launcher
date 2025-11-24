#[cfg(windows)]
pub(crate) mod windows {
    use anyhow::{Context, Result, bail};
    use std::ffi::{OsStr, OsString};
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;
    use std::sync::OnceLock;

    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
        SetInformationJobObject,
    };
    use windows::Win32::System::Threading::{
        CREATE_SUSPENDED, CreateProcessW, PROCESS_INFORMATION, ResumeThread, STARTUPINFOW,
        TerminateProcess,
    };

    use windows::core::{PCWSTR, PWSTR};
    #[derive(Clone, Copy, Debug)]
    pub struct JobHandle(pub HANDLE);

    unsafe impl Send for JobHandle {}
    unsafe impl Sync for JobHandle {}

    static JOB_OBJECT: OnceLock<JobHandle> = OnceLock::new();

    fn ensure_job() -> Result<JobHandle> {
        if let Some(h) = JOB_OBJECT.get() {
            return Ok(*h);
        }

        unsafe {
            let h = CreateJobObjectW(None, PCWSTR::null())
                .ok()
                .context("CreateJobObject failed")?;

            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            SetInformationJobObject(
                h,
                JobObjectExtendedLimitInformation,
                &mut info as *mut _ as *mut _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
            .ok()
            .context("SetInformationJobObject failed")?;

            JOB_OBJECT.set(JobHandle(h)).unwrap();
            Ok(JobHandle(h))
        }
    }

    fn make_command_line(program: &OsStr, args: &[OsString]) -> Vec<u16> {
        let mut cmd: Vec<u16> = Vec::new();

        append_quoted(program, &mut cmd);

        for arg in args {
            cmd.push(' ' as u16);
            append_quoted(arg.as_os_str(), &mut cmd);
        }

        cmd.push(0); // null-terminate
        cmd
    }

    fn append_quoted(s: &OsStr, out: &mut Vec<u16>) {
        out.push('"' as u16);
        out.extend(s.encode_wide());
        out.push('"' as u16);
    }

    /// Thin wrapper to handle adding to job before executing.
    ///
    /// Avoids Tokio races with assigning to job while still allowing direct killing of the Child.
    #[allow(unused)]
    pub struct JobChild {
        process: HANDLE,
        thread: HANDLE,
        pid: u32,
    }

    unsafe impl Send for JobChild {}
    unsafe impl Sync for JobChild {}

    impl JobChild {
        pub async fn kill(&self) -> Result<()> {
            unsafe { TerminateProcess(self.process, 1).ok() };
            Ok(())
        }
    }

    /// Spawn a Child inside of a job object.
    ///
    /// ## Technical Description:
    ///  
    /// We handle the raw creation of process to have full handle over it using `CREATE_SUSPENDED` creation flag to not directly run it and instead wait for
    /// the job assignment.
    ///
    /// This is needed instead tokio creation_flags since we can get the `main_thread_handle`/`hThread` from  which we cannot take from Tokio's Child Process.
    ///
    /// `PROCESS_INFORMATION` contains `hThread` which gets populate inside of `CreateProcessW` when we pass a mutable pointer to it.
    ///
    /// See more here: https://github.com/tokio-rs/tokio/issues/6153
    ///
    /// If you spawn normally (even with tokio::Child), the process might start executing immediately on its main thread
    /// since some Windows APIs check if threads are already running and will refuse Job Object assignment (Access Denied) if any thread has started.
    ///
    /// Reminder that assigning a `CREATION_FLAG` is not possible after a process has been created.
    ///
    /// **TL;DR**: We create the process suspended, attach it to the Job Object, then resume it.
    /// Tokio’s Child API can’t give the main thread handle, so normal spawning risks Access Denied errors due to races.
    /// Creation flags can’t be changed after the process starts.
    pub fn spawn_with_job_object(
        exe: impl AsRef<Path>,
        args: &[impl AsRef<OsStr>],
        cwd: Option<&Path>,
    ) -> Result<JobChild> {
        let job = ensure_job()?;

        let exe = exe.as_ref().as_os_str();
        let args_os: Vec<_> = args.iter().map(|a| a.as_ref().to_owned()).collect();
        let mut cmd = make_command_line(exe, &args_os);

        unsafe {
            let mut si: STARTUPINFOW = std::mem::zeroed();
            si.cb = std::mem::size_of::<STARTUPINFOW>() as u32;

            let mut pi: PROCESS_INFORMATION = std::mem::zeroed();

            // `CreateProcessW` needs a UTF-16 encoded and null terminated string for paths so we encode, null-terminate it and turn it into a contiguous buffer.
            let cwd_wide = cwd.map(|p| {
                p.as_os_str()
                    .encode_wide()
                    .chain(once(0))
                    .collect::<Vec<u16>>()
            });

            let lp_dir = cwd_wide
                .as_ref()
                .map(|v| PCWSTR(v.as_ptr()))
                .unwrap_or(PCWSTR::null());

            let ok = CreateProcessW(
                PCWSTR::null(),
                Some(PWSTR(cmd.as_mut_ptr())),
                None,
                None,
                false,
                CREATE_SUSPENDED,
                None,
                lp_dir,
                &si,
                // process information gets populated here.
                &mut pi,
            );

            if ok.is_err() {
                bail!("CreateProcessW failed: {}", ok.err().unwrap());
            }

            let ok2 = AssignProcessToJobObject(job.0, pi.hProcess);
            if ok2.is_err() {
                // :3 who needs to propagate errors anyways
                _ = CloseHandle(pi.hThread);
                _ = CloseHandle(pi.hProcess);
                bail!("AssignProcessToJobObject failed: {}", ok.err().unwrap());
            }

            ResumeThread(pi.hThread);

            Ok(JobChild {
                process: pi.hProcess,
                thread: pi.hThread,
                pid: pi.dwProcessId,
            })
        }
    }
}

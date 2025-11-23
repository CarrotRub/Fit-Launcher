#[cfg(windows)]
pub(crate) mod windows {
    #[cfg(windows)]
    use std::sync::OnceLock;

    use tokio::process::Child;
    use windows::Win32::Foundation::HANDLE;

    #[cfg(windows)]
    #[derive(Clone, Copy)]
    pub struct SafeHandle(HANDLE);

    #[cfg(windows)]
    unsafe impl Send for SafeHandle {}

    #[cfg(windows)]
    unsafe impl Sync for SafeHandle {}

    #[cfg(windows)]
    pub static JOB_OBJECT: OnceLock<SafeHandle> = OnceLock::new();

    pub(crate) fn set_child_in_job(child: &Child) {
        #[cfg(windows)]
        {
            unsafe {
                use windows::Win32::{
                    Foundation::HANDLE, System::JobObjects::AssignProcessToJobObject,
                };

                if JOB_OBJECT.get().is_none() {
                    use windows::{
                        Win32::System::JobObjects::{
                            CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
                            JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
                            JobObjectExtendedLimitInformation, SetInformationJobObject,
                        },
                        core::PCWSTR,
                    };

                    let h = CreateJobObjectW(Some(std::ptr::null_mut()), PCWSTR::null());
                    if h.is_err() {
                        panic!("Failed to create job object");
                    }

                    let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                    info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

                    let handle = h.unwrap();

                    if SetInformationJobObject(
                        handle,
                        JobObjectExtendedLimitInformation,
                        &mut info as *mut _ as *mut _,
                        std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                    )
                    .is_err()
                    {
                        panic!("Failed to set job object kill-on-close");
                    }

                    JOB_OBJECT.set(SafeHandle(handle));
                }

                let child_ptr = child.raw_handle().unwrap();
                let child_handle: HANDLE = HANDLE(child_ptr);
                let ok = AssignProcessToJobObject(JOB_OBJECT.get().unwrap().0, child_handle);
                if ok.is_err() {
                    panic!("Failed to assign aria2c to job object");
                }
            }
        }
    }
}

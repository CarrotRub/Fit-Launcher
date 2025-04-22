use tauri_build::WindowsAttributes;

fn main() {
    let win_attr = if tauri_build::is_dev() {
        WindowsAttributes::new()
    } else {
        WindowsAttributes::new().app_manifest(
            r#"
    <assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
      <dependency>
        <dependentAssembly>
          <assemblyIdentity
            type="win32"
            name="Microsoft.Windows.Common-Controls"
            version="6.0.0.0"
            processorArchitecture="*"
            publicKeyToken="6595b64144ccf1df"
            language="*"
          />
        </dependentAssembly>
      </dependency>
      <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
        <security>
            <requestedPrivileges>
                <requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
            </requestedPrivileges>
        </security>
      </trustInfo>
    </assembly>
    "#,
        )
    };

    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(win_attr))
        .expect("failed to run build script");
}

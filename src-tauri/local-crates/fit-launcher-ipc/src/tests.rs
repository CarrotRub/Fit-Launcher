use super::*;

#[test]
fn test_encode_decode_roundtrip() {
    let cmd = Command::StartInstall {
        job_id: "test-123".into(),
        setup_path: r"C:\Games\setup.exe".into(),
        install_path: r"C:\Games\MyGame".into(),
        options: InstallOptions::default(),
    };

    let encoded = encode_message(&cmd).unwrap();
    let (decoded, consumed): (Command, _) = decode_message(&encoded).unwrap().unwrap();

    assert_eq!(consumed, encoded.len());
    if let Command::StartInstall { job_id, .. } = decoded {
        assert_eq!(job_id, "test-123");
    } else {
        panic!("Expected StartInstall");
    }
}

#[test]
fn test_decode_partial() {
    let cmd = Command::Ping;
    let encoded = encode_message(&cmd).unwrap();

    assert!(decode_message::<Command>(&encoded[..3]).unwrap().is_none());
    assert!(decode_message::<Command>(&encoded).unwrap().is_some());
}

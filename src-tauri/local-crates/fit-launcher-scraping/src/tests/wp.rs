use std::time::Instant;

use crate::wordpress::get_game_list_wp;

#[tokio::test]
async fn curl_baseline() {
    let output = std::process::Command::new("curl")
        .args([
            "-w", "\ntime_namelookup: %{time_namelookup}\ntime_connect: %{time_connect}\ntime_appconnect: %{time_appconnect}\ntime_pretransfer: %{time_pretransfer}\ntime_starttransfer: %{time_starttransfer}\ntime_total: %{time_total}\n",
            "-o", "/dev/null",
            "-s",
            "https://fitgirl-repacks.site/wp-json/wp/v2/posts?categories=5&per_page=99",
        ])
        .output()
        .expect("failed to execute curl");

    println!("{}", String::from_utf8_lossy(&output.stderr));
    println!("{}", String::from_utf8_lossy(&output.stdout));
}

#[tokio::test]
async fn wordpress_parsing() {
    let now = Instant::now();

    let games = get_game_list_wp(2).await.unwrap();
    println!("warm up did: {:#?}", now.elapsed());
    println!("Game sec images: {:#?}", games[0]);

    assert_eq!(games.len(), 2)
}

#[test]
fn curl_lib_baseline() {
    use curl::easy::Easy;
    use std::time::Instant;

    let mut easy = Easy::new();
    easy.url("https://fitgirl-repacks.site/wp-json/wp/v2/posts?categories=5&per_page=2")
        .unwrap();
    easy.follow_location(true).unwrap();

    let now = Instant::now();
    let mut body_len = 0usize;

    {
        let mut transfer = easy.transfer();
        transfer
            .write_function(|data| {
                body_len += data.len();
                Ok(data.len())
            })
            .unwrap();
        transfer.perform().unwrap();
    }

    let elapsed = now.elapsed();
    let mut info = easy;

    println!("status: {}", info.response_code().unwrap());
    println!("body len: {}", body_len);
    println!(
        "namelookup:    {:.3}s",
        info.namelookup_time().unwrap().as_secs_f64()
    );
    println!(
        "connect:       {:.3}s",
        info.connect_time().unwrap().as_secs_f64()
    );
    println!(
        "appconnect:    {:.3}s",
        info.appconnect_time().unwrap().as_secs_f64()
    );
    println!(
        "pretransfer:   {:.3}s",
        info.pretransfer_time().unwrap().as_secs_f64()
    );
    println!(
        "starttransfer: {:.3}s",
        info.starttransfer_time().unwrap().as_secs_f64()
    );
    println!("total:         {:.3}s", elapsed.as_secs_f64());
}

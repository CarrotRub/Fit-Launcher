//! DDOS-Guard captcha bypass handling.

use fit_launcher_config::client::{
    cookies::{Cookie, Cookies},
    dns::{CUSTOM_DNS_CLIENT, build_dns_client},
};
use once_cell::sync::Lazy;
use tauri::{Listener, Url, WindowEvent};
use time::format_description::well_known::Rfc2822;
use tokio::sync::Mutex;
use tracing::info;

use crate::errors::ScrapingError;

async fn update_client_cookies(new_cookies: Vec<Cookie>) {
    Cookies(new_cookies).save().unwrap();
    *CUSTOM_DNS_CLIENT.write().await = build_dns_client();
}

pub async fn handle_ddos_guard_captcha(
    app: &tauri::AppHandle,
    url: &str,
) -> Result<(), ScrapingError> {
    static COOKIES_UPDATED: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

    let mut cookies_updated = COOKIES_UPDATED.lock().await;
    if *cookies_updated {
        return Ok(());
    }

    let win = tauri::WebviewWindowBuilder::new(
        app,
        "ddos_guard_solver",
        tauri::WebviewUrl::External(url.parse().unwrap()),
    )
    .title("Solve Captcha")
    .build()
    .map_err(|e| ScrapingError::WindowError(e.to_string()))?;

    let (tx, rx) = std::sync::mpsc::channel();

    let win_for_eval = win.clone();
    win.once("tauri://page-loaded", move |_| {
        let _ = win_for_eval.eval(
            r#"
        window.addEventListener('load', () => {
            setInterval(() => {
                if (document.querySelector(".site-title") !== null) {
                    window.close();
                }
            }, 500);
        }, false);
        "#,
        );
    });

    win.on_window_event(move |event| {
        if let WindowEvent::Destroyed = event {
            let _ = tx.send(());
        }
    });

    rx.recv().unwrap();

    // Get cookies after window destroyed
    let win = tauri::WebviewWindowBuilder::new(
        app,
        "cookies_exporter",
        tauri::WebviewUrl::External(Url::parse("about:blank").unwrap()),
    )
    .title("get cookies")
    .visible(false)
    .build()
    .map_err(|e| ScrapingError::WindowError(e.to_string()))?;

    let all_cookies = win
        .cookies()
        .map_err(|e| ScrapingError::CookieError(e.to_string()))?;

    _ = win.close();

    let target_url = Url::parse(url).map_err(|e| ScrapingError::UrlParseError(e.to_string()))?;
    let target_host = target_url
        .host_str()
        .ok_or_else(|| ScrapingError::UrlParseError("URL has no host".to_string()))?
        .to_string();

    let captured_cookies = all_cookies
        .into_iter()
        .filter(|cookie| {
            if !cookie.name().contains("__ddg") {
                return false;
            }

            cookie.domain().is_some_and(|domain| {
                let clean_domain = domain.trim_start_matches('.');
                target_host == clean_domain || target_host.ends_with(&format!(".{clean_domain}"))
            })
        })
        .map(|c| Cookie {
            name: c.name().to_string(),
            value: c.value().to_string(),
            domain: c.domain().map(|d| d.to_string()),
            path: c.path().map(|p| p.to_string()),
            expires: Some(
                c.expires()
                    .unwrap()
                    .datetime()
                    .unwrap()
                    .format(&Rfc2822)
                    .unwrap(),
            ),
            max_age: c.max_age().map(|d| d.whole_seconds()),
        })
        .collect();

    info!("updating cookies...");
    update_client_cookies(captured_cookies).await;
    *cookies_updated = true;

    Ok(())
}

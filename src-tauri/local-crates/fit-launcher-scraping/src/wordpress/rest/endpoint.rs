use crate::ScrapingError;
use curl::easy::Easy;
use serde::{Serialize, de::DeserializeOwned};
use std::marker::PhantomData;

pub trait EndpointSpec {
    type Req: Serialize;
    type Resp: DeserializeOwned;
    const PATH: &'static str;
}

pub struct Endpoint<S: EndpointSpec> {
    _marker: PhantomData<S>,
}

impl<S: EndpointSpec> Endpoint<S> {
    pub fn new() -> Self {
        Self {
            _marker: PhantomData,
        }
    }

    pub async fn call_query(&self, query: &S::Req) -> Result<S::Resp, ScrapingError> {
        // serialize query struct to "key=value&key=value"
        let query_string = serde_urlencoded::to_string(query)
            .map_err(|e| ScrapingError::UrlEncoder(e.to_string()))?;

        let url = if query_string.is_empty() {
            S::PATH.to_string()
        } else if S::PATH.contains('?') {
            format!("{}&{}", S::PATH, query_string)
        } else {
            format!("{}?{}", S::PATH, query_string)
        };

        let cookies = fit_launcher_config::client::cookies::Cookies::load_cookies()
            .ok()
            .map(|c| c.to_header());

        let body = tokio::task::spawn_blocking(move || -> Result<Vec<u8>, String> {
            let mut easy = Easy::new();
            easy.url(&url).map_err(|e| e.to_string())?;
            easy.follow_location(true).map_err(|e| e.to_string())?;

            if let Some(cookie_header) = cookies {
                easy.cookie(&cookie_header).map_err(|e| e.to_string())?;
            }

            let mut buf = Vec::new();
            {
                let mut transfer = easy.transfer();
                transfer
                    .write_function(|data| {
                        buf.extend_from_slice(data);
                        Ok(data.len())
                    })
                    .map_err(|e| e.to_string())?;
                transfer.perform().map_err(|e| e.to_string())?;
            }

            let status = easy.response_code().map_err(|e| e.to_string())?;
            if !(200..300).contains(&status) {
                return Err(format!("HTTP error: {}", status));
            }

            Ok(buf)
        })
        .await
        .map_err(|e| ScrapingError::SemaphoreError(e.to_string()))?
        .map_err(ScrapingError::SemaphoreError)?;

        serde_json::from_slice(&body).map_err(|e| ScrapingError::JsonError(e.to_string()))
    }
}

impl<S: EndpointSpec> Default for Endpoint<S> {
    fn default() -> Self {
        Self::new()
    }
}

pub struct EnpointWpLosslessRepack;

impl EndpointSpec for EnpointWpLosslessRepack {
    type Req = crate::wordpress::rest::query::QueryWpLosslessRepack;
    type Resp = Vec<crate::wordpress::rest::models::WpPost>;
    const PATH: &'static str = "https://fitgirl-repacks.site/wp-json/wp/v2/posts?categories=5";
}

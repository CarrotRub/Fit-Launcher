#[cfg(test)]
mod actions;

#[cfg(test)]
fn init_test_tracing() {
    use std::sync::Once;
    use tracing_subscriber::{EnvFilter, fmt, prelude::*};

    static INIT: Once = Once::new();

    INIT.call_once(|| {
        let stdout_layer = fmt::layer()
            .with_writer(std::io::stdout)
            .with_target(false)
            .with_ansi(false)
            .with_filter(EnvFilter::new("debug"));

        let stderr_layer = fmt::layer()
            .with_writer(std::io::stderr)
            .with_target(false)
            .with_ansi(false)
            .with_filter(EnvFilter::new("error"));

        tracing_subscriber::registry()
            .with(stdout_layer)
            .with(stderr_layer)
            .init();
    });
}

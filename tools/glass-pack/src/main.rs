use std::path::PathBuf;

use clap::{Parser, Subcommand};
use session_engine::{
    read_glass_pack, validate_glass_pack_bytes, validate_glass_pack_bytes_strict,
};

#[derive(Parser)]
#[command(name = "glass-pack", version, about = "Glass pack tooling")]
struct Cli {
    #[command(subcommand)]
    cmd: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Validate pack (ZIP + manifest + events). Default: Basic. `--strict` enforces spec §12.5 kinds.
    Validate {
        path: PathBuf,
        #[arg(long)]
        strict: bool,
    },
    /// Print manifest and event count.
    Info { path: PathBuf },
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    match cli.cmd {
        Command::Validate { path, strict } => {
            let bytes = std::fs::read(&path)?;
            if strict {
                validate_glass_pack_bytes_strict(&bytes)?;
            } else {
                validate_glass_pack_bytes(&bytes)?;
            }
            println!("OK {} (strict={})", path.display(), strict);
        }
        Command::Info { path } => {
            let (m, evs) = read_glass_pack(&path)?;
            println!("session_id: {}", m.session_id);
            println!("pack_format: {}", m.pack_format_version);
            println!("events_blob: {:?}", m.events_blob);
            println!("sanitized: {}", m.sanitized);
            println!("events: {}", evs.len());
        }
    }
    Ok(())
}

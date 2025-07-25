use eframe::egui;
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::Write;
use chrono::Local;
use wooting_analog_wrapper::ffi::{
    wooting_analog_initialise, wooting_analog_read_analog, wooting_analog_uninitialise,
};

struct Key {
    index: usize,
    label: &'static str,
}

struct HeatmapApp {
    key_values: [f32; 256],
    pressed_keys: HashMap<String, f32>,
}

impl Default for HeatmapApp {
    fn default() -> Self {
        Self {
            key_values: [0.0; 256],
            pressed_keys: HashMap::new(),
        }
    }
}

const LAYOUT: &[&[Key]] = &[
    &[Key { index: 41, label: "Esc" }, Key { index: 58, label: "F1" }, Key { index: 59, label: "F2" }, Key { index: 60, label: "F3" }, Key { index: 61, label: "F4" }, Key { index: 62, label: "F5" }, Key { index: 63, label: "F6" }, Key { index: 64, label: "F7" }, Key { index: 65, label: "F8" }, Key { index: 66, label: "F9" }, Key { index: 67, label: "F10" }, Key { index: 68, label: "F11" }, Key { index: 69, label: "F12" }],
    &[Key { index: 53, label: "`" }, Key { index: 30, label: "1" }, Key { index: 31, label: "2" }, Key { index: 32, label: "3" }, Key { index: 33, label: "4" }, Key { index: 34, label: "5" }, Key { index: 35, label: "6" }, Key { index: 36, label: "7" }, Key { index: 37, label: "8" }, Key { index: 38, label: "9" }, Key { index: 39, label: "0" }, Key { index: 45, label: "-" }, Key { index: 46, label: "=" }, Key { index: 42, label: "Back" }],
    &[Key { index: 43, label: "Tab" }, Key { index: 20, label: "Q" }, Key { index: 26, label: "W" }, Key { index: 8, label: "E" }, Key { index: 21, label: "R" }, Key { index: 23, label: "T" }, Key { index: 28, label: "Y" }, Key { index: 24, label: "U" }, Key { index: 12, label: "I" }, Key { index: 18, label: "O" }, Key { index: 19, label: "P" }, Key { index: 47, label: "[" }, Key { index: 48, label: "]" }, Key { index: 49, label: "\\" }],
    &[Key { index: 57, label: "Caps" }, Key { index: 4, label: "A" }, Key { index: 22, label: "S" }, Key { index: 7, label: "D" }, Key { index: 9, label: "F" }, Key { index: 10, label: "G" }, Key { index: 11, label: "H" }, Key { index: 13, label: "J" }, Key { index: 14, label: "K" }, Key { index: 15, label: "L" }, Key { index: 51, label: ";" }, Key { index: 52, label: "'" }, Key { index: 40, label: "Enter" }],
    &[Key { index: 225, label: "Shift" }, Key { index: 29, label: "Z" }, Key { index: 27, label: "X" }, Key { index: 6, label: "C" }, Key { index: 25, label: "V" }, Key { index: 5, label: "B" }, Key { index: 17, label: "N" }, Key { index: 16, label: "M" }, Key { index: 54, label: "," }, Key { index: 55, label: "." }, Key { index: 56, label: "/" }, Key { index: 229, label: "Shift" }],
    &[Key { index: 224, label: "Ctrl" }, Key { index: 227, label: "Win" }, Key { index: 226, label: "Alt" }, Key { index: 44, label: "Space" }, Key { index: 230, label: "Menu" }, Key { index: 228, label: "Ctrl" }],
];

impl eframe::App for HeatmapApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        unsafe {
            for idx in 0..self.key_values.len() {
                self.key_values[idx] = wooting_analog_read_analog(idx as u16);
            }
        }

        // update pressed keys map
        for row in LAYOUT {
            for key in *row {
                let value = self.key_values[key.index];
                if value > 0.01 {
                    self.pressed_keys.insert(key.label.to_string(), value);
                } else {
                    self.pressed_keys.remove(key.label);
                }
            }
        }

        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("Wooting Heatmap + Live Console");
            ui.separator();

            for row in LAYOUT {
                ui.horizontal(|ui| {
                    for key in *row {
                        let value = self.key_values[key.index];
                        let intensity = (value * 255.0).clamp(0.0, 255.0) as u8;
                        let color = egui::Color32::from_rgb(intensity, 255 - intensity, 255 - intensity);

                        ui.add_sized(
                            [40.0, 40.0],
                            egui::Button::new(key.label).fill(color),
                        );
                    }
                });
            }

            ui.separator();
            ui.label("Currently pressed:");
            for (k, v) in &self.pressed_keys {
                ui.label(format!("{}: {:.2}", k, v));
            }
        });

        if !self.pressed_keys.is_empty() {
            let now = Local::now().format("%H:%M:%S").to_string();
            let line = format!(
                "[{}] {}\n",
                now,
                self.pressed_keys
                    .iter()
                    .map(|(k, v)| format!("{}({:.2})", k, v))
                    .collect::<Vec<_>>()
                    .join(", ")
            );

            let mut file = OpenOptions::new()
                .create(true)
                .append(true)
                .open("key_log.txt")
                .unwrap();
            let _ = file.write_all(line.as_bytes());

            print!("\r{}", line.trim());
        }

        ctx.request_repaint();
    }
}

fn main() {
    unsafe {
        let result = wooting_analog_initialise();
        if result == 0 {
            eprintln!("❌ Failed to initialize Wooting Analog SDK.");
            return;
        }
    }

    let options = eframe::NativeOptions {
        viewport: egui::viewport::ViewportBuilder::default().with_inner_size([1000.0, 700.0]),
        ..Default::default()
    };

    let result = eframe::run_native(
        "Wooting Heatmap",
        options,
        Box::new(|_cc| Box::new(HeatmapApp::default())),
    );

    unsafe { wooting_analog_uninitialise(); }

    if let Err(err) = result {
        eprintln!("Error: {}", err);
    }
}

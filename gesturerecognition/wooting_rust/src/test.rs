use eframe::egui;

struct MyApp;

impl eframe::App for MyApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("Hello world!");
        });
    }
}

fn main() {
    let options = eframe::NativeOptions::default();
    let result = eframe::run_native(
        "Test Window",
        options,
        Box::new(|_cc| Box::new(MyApp)),
    );

    if let Err(err) = result {
        eprintln!("Error: {}", err);
    }
}

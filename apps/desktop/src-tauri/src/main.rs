// Pas de console noire derrière la fenêtre en version installée.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gstock_desktop_lib::run();
}

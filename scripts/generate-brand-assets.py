#!/usr/bin/env python3
import os
import subprocess
from PIL import Image

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SVG_PATH = os.path.join(ROOT_DIR, "totumvault-logo.svg")
BASE_PNG_PATH = os.path.join(ROOT_DIR, "public", "totumvault-logo-1024.png")

def main():
    print(f"Generating 1024x1024 base PNG from {SVG_PATH}...")
    subprocess.run([
        "magick",
        "-background", "none",
        SVG_PATH,
        "-resize", "1024x1024",
        BASE_PNG_PATH
    ], check=True)

    base_img = Image.open(BASE_PNG_PATH).convert("RGBA")

    # Define targets: (rel_path, width, height)
    png_targets = [
        ("public/logo.png", 512, 512),
        ("public/logo-512.png", 512, 512),
        ("public/logo-192.png", 192, 192),
        ("public/logo-32.png", 32, 32),
        ("src/assets/logo.png", 512, 512),
        ("src-tauri/icons/icon.png", 512, 512),
        ("src-tauri/icons/32x32.png", 32, 32),
        ("src-tauri/icons/64x64.png", 64, 64),
        ("src-tauri/icons/128x128.png", 128, 128),
        ("src-tauri/icons/128x128@2x.png", 256, 256),
        # Windows Store / Square icons
        ("src-tauri/icons/Square30x30Logo.png", 30, 30),
        ("src-tauri/icons/Square44x44Logo.png", 44, 44),
        ("src-tauri/icons/Square71x71Logo.png", 71, 71),
        ("src-tauri/icons/Square89x89Logo.png", 89, 89),
        ("src-tauri/icons/Square107x107Logo.png", 107, 107),
        ("src-tauri/icons/Square142x142Logo.png", 142, 142),
        ("src-tauri/icons/Square150x150Logo.png", 150, 150),
        ("src-tauri/icons/Square284x284Logo.png", 284, 284),
        ("src-tauri/icons/Square310x310Logo.png", 310, 310),
        ("src-tauri/icons/StoreLogo.png", 50, 50),
        # Android mipmap
        ("src-tauri/icons/android/mipmap-mdpi/ic_launcher.png", 48, 48),
        ("src-tauri/icons/android/mipmap-mdpi/ic_launcher_round.png", 48, 48),
        ("src-tauri/icons/android/mipmap-mdpi/ic_launcher_foreground.png", 108, 108),
        ("src-tauri/icons/android/mipmap-hdpi/ic_launcher.png", 72, 72),
        ("src-tauri/icons/android/mipmap-hdpi/ic_launcher_round.png", 72, 72),
        ("src-tauri/icons/android/mipmap-hdpi/ic_launcher_foreground.png", 162, 162),
        ("src-tauri/icons/android/mipmap-xhdpi/ic_launcher.png", 96, 96),
        ("src-tauri/icons/android/mipmap-xhdpi/ic_launcher_round.png", 96, 96),
        ("src-tauri/icons/android/mipmap-xhdpi/ic_launcher_foreground.png", 216, 216),
        ("src-tauri/icons/android/mipmap-xxhdpi/ic_launcher.png", 144, 144),
        ("src-tauri/icons/android/mipmap-xxhdpi/ic_launcher_round.png", 144, 144),
        ("src-tauri/icons/android/mipmap-xxhdpi/ic_launcher_foreground.png", 324, 324),
        ("src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher.png", 192, 192),
        ("src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher_round.png", 192, 192),
        ("src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher_foreground.png", 432, 432),
        # iOS AppIcon
        ("src-tauri/icons/ios/AppIcon-20x20@1x.png", 20, 20),
        ("src-tauri/icons/ios/AppIcon-20x20@2x.png", 40, 40),
        ("src-tauri/icons/ios/AppIcon-20x20@2x-1.png", 40, 40),
        ("src-tauri/icons/ios/AppIcon-20x20@3x.png", 60, 60),
        ("src-tauri/icons/ios/AppIcon-29x29@1x.png", 29, 29),
        ("src-tauri/icons/ios/AppIcon-29x29@2x.png", 58, 58),
        ("src-tauri/icons/ios/AppIcon-29x29@2x-1.png", 58, 58),
        ("src-tauri/icons/ios/AppIcon-29x29@3x.png", 87, 87),
        ("src-tauri/icons/ios/AppIcon-40x40@1x.png", 40, 40),
        ("src-tauri/icons/ios/AppIcon-40x40@2x.png", 80, 80),
        ("src-tauri/icons/ios/AppIcon-40x40@2x-1.png", 80, 80),
        ("src-tauri/icons/ios/AppIcon-40x40@3x.png", 120, 120),
        ("src-tauri/icons/ios/AppIcon-60x60@2x.png", 120, 120),
        ("src-tauri/icons/ios/AppIcon-60x60@3x.png", 180, 180),
        ("src-tauri/icons/ios/AppIcon-76x76@1x.png", 76, 76),
        ("src-tauri/icons/ios/AppIcon-76x76@2x.png", 152, 152),
        ("src-tauri/icons/ios/AppIcon-83.5x83.5@2x.png", 167, 167),
        ("src-tauri/icons/ios/AppIcon-512@2x.png", 1024, 1024),
    ]

    for rel_path, w, h in png_targets:
        out_file = os.path.join(ROOT_DIR, rel_path)
        os.makedirs(os.path.dirname(out_file), exist_ok=True)
        resized = base_img.resize((w, h), Image.Resampling.LANCZOS)
        resized.save(out_file, "PNG")
        print(f"Generated {rel_path} ({w}x{h})")

    # Generate ICO files
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    ico_targets = ["public/favicon.ico", "src-tauri/icons/icon.ico"]
    for rel_path in ico_targets:
        out_file = os.path.join(ROOT_DIR, rel_path)
        os.makedirs(os.path.dirname(out_file), exist_ok=True)
        base_img.save(out_file, format="ICO", sizes=ico_sizes)
        print(f"Generated {rel_path} (ICO)")

    # Generate ICNS for macOS
    icns_file = os.path.join(ROOT_DIR, "src-tauri/icons/icon.icns")
    base_img.save(icns_file, format="ICNS")
    print("Generated src-tauri/icons/icon.icns (ICNS)")

    # Also copy svg to public/totumvault-logo.svg
    public_svg = os.path.join(ROOT_DIR, "public", "totumvault-logo.svg")
    with open(SVG_PATH, "r") as f_in, open(public_svg, "w") as f_out:
        f_out.write(f_in.read())
    print("Copied totumvault-logo.svg to public/totumvault-logo.svg")

    # Cleanup base png
    if os.path.exists(BASE_PNG_PATH):
        os.remove(BASE_PNG_PATH)
    print("All branding assets generated successfully!")

if __name__ == "__main__":
    main()

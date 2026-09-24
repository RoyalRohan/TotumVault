#!/usr/bin/env bash
set -euo pipefail

# Update pacman and install packaging tools
pacman -Syu --noconfirm base-devel binutils zstd

# Create non-root builduser for makepkg
useradd -m builduser
echo "builduser ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

BUILD_DIR="/home/builduser/build"
mkdir -p "$BUILD_DIR"
find /workspace/deb-package -type f -name "*.deb" -exec cp -f {} "$BUILD_DIR/" \;
cd "$BUILD_DIR"

DEB_FILE=$(find "$BUILD_DIR" -type f -name "*.deb" | head -n 1)
if [ -z "$DEB_FILE" ]; then
  echo "Error: No .deb package found in /workspace/deb-package"
  exit 1
fi
echo "Using deb package: $DEB_FILE"

ar x "$DEB_FILE"
mkdir -p "$BUILD_DIR/src/pkg-data"
tar -xf data.tar.* -C "$BUILD_DIR/src/pkg-data"

TAG="${1:-1.1.0}"
VER="${TAG#v}"

cat << 'INNER_EOF' > PKGBUILD
pkgname=totumvault-bin
pkgver=VERSION_PLACEHOLDER
pkgrel=1
pkgdesc="Production distribution packages for TotumVault Password Manager"
arch=('x86_64')
url="https://github.com/RoyalRohan/TotumVault"
license=('custom')
depends=('webkit2gtk-4.1' 'gtk3' 'openssl' 'libayatana-appindicator')
provides=('totumvault')
conflicts=('totumvault')
options=('!strip')

package() {
  cp -a "${srcdir}/pkg-data/." "${pkgdir}/"
}
INNER_EOF

sed -i "s/VERSION_PLACEHOLDER/${VER}/g" PKGBUILD
chown -R builduser:builduser "$BUILD_DIR"

sudo -u builduser makepkg -f --nodeps

mkdir -p /workspace/arch-pkg
find . -maxdepth 1 -type f -name "*.pkg.tar.zst" -exec cp -f {} /workspace/arch-pkg/ \;
chmod -R 777 /workspace/arch-pkg

if [ -z "$(ls -A /workspace/arch-pkg/*.pkg.tar.zst 2>/dev/null)" ]; then
  echo "Error: No .pkg.tar.zst was created in /workspace/arch-pkg"
  exit 1
fi
echo "Arch package generated successfully:"
ls -lh /workspace/arch-pkg/

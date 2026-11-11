#!/usr/bin/env bash
# Creates web-sized copies of the full-size photos in `photos/` (not deployed)
# in `public/images/` as <name>-800.jpg and <name>-1600.jpg. Requires macOS `sips`.
#
# Usage: scripts/resize-photos.sh
set -euo pipefail

cd "$(dirname "$0")/.."

SRC=photos
OUT=public/images
WIDTHS=(800 1600)
QUALITY=60

mkdir -p "$OUT"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# source file | output name | crop (none | right:<percent> | landscape:<y offset>)
PHOTOS=(
  "gebouwen_buiten.jpg|terrein-gebouwen|none"
  "groot_gebouw_buiten.jpg|groot-gebouw|right:15"
  "groot_lokaal_grote_gebouw.jpg|groot-gebouw-grote-ruimte|none"
  "keuken_grote_gebouw.jpg|groot-gebouw-keuken|none"
  "kleine_gebouw_buiten.jpg|klein-gebouw|right:15"
  "lokaal_kleine_gebouw_1.jpg|klein-gebouw-ruimte-1|none"
  "lokaal_kleine_gebouw_2.jpg|klein-gebouw-ruimte-2|none"
  "washok_kleine_gebouw.jpg|klein-gebouw-washok|landscape:1100"
)

dimension() { sips -g "$2" "$1" | awk -v key="$2" '$1 == key":" { print $2 }'; }

for entry in "${PHOTOS[@]}"; do
  IFS='|' read -r file name crop <<<"$entry"
  input="$SRC/$file"
  width=$(dimension "$input" pixelWidth)
  height=$(dimension "$input" pixelHeight)
  working="$input"

  case "$crop" in
    right:*)
      # Crop a strip off the right edge (keeps the left side of the picture).
      percent=${crop#right:}
      sips -c "$height" $((width * (100 - percent) / 100)) --cropOffset 0 0 "$input" --out "$tmp/$name.jpg" >/dev/null
      working="$tmp/$name.jpg"
      ;;
    landscape:*)
      # Turn a portrait photo into 4:3 (the ratio of `app-photo`), starting at the given y offset.
      offset=${crop#landscape:}
      sips -c $((width * 3 / 4)) "$width" --cropOffset "$offset" 0 "$input" --out "$tmp/$name.jpg" >/dev/null
      working="$tmp/$name.jpg"
      ;;
  esac

  for target in "${WIDTHS[@]}"; do
    sips --resampleWidth "$target" -s format jpeg -s formatOptions "$QUALITY" "$working" --out "$OUT/$name-$target.jpg" >/dev/null
    echo "$OUT/$name-$target.jpg"
  done
done

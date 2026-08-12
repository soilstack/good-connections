#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_file="$script_dir/card-themes.typ"
output_dir="$script_dir/rendered"

if ! command -v typst >/dev/null 2>&1; then
  printf '%s\n' 'typst is required: https://typst.app/open-source/' >&2
  exit 1
fi

mkdir -p "$output_dir"

for theme in nocturne atelier signal; do
  typst compile --input "theme=$theme" --input view=hero \
    "$source_file" "$output_dir/$theme-hero.svg"
  typst compile --input "theme=$theme" --input view=hero --ppi 180 \
    "$source_file" "$output_dir/$theme-hero.png"
  typst compile --input "theme=$theme" --input view=deck \
    "$source_file" "$output_dir/$theme-deck.svg"
done

printf 'Rendered three themes to %s\n' "$output_dir"

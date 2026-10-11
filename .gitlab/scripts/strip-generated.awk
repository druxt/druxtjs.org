# Drops the blocks a review bot writes into a merge request description, so the
# prose checks read what a person wrote.
#
# A block runs from an auto-generated marker to its end marker. An opening
# marker with no end is not a block: the text after it is held back, then
# printed at the end, because a description that silently turns the rest of the
# checks off is a check that cannot go red.

/^<!-- (This is an )?auto-generated comment/ {
  if (!skip) {
    skip = 1
    held = ""
  }
}

skip {
  held = held $0 "\n"
  if ($0 ~ /^<!-- end of auto-generated comment/) {
    skip = 0
    held = ""
  }
  next
}

{ print }

END {
  # Reached the end still inside a block: it was never a block.
  if (skip) printf "%s", held
}

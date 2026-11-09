export function rectanglesOverlap(a, b) {
  return a.right > a.left && a.bottom > a.top && b.right > b.left && b.bottom > b.top &&
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

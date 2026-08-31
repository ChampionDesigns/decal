// CANARY — retirement-spelling.
//: the shots list is {items, total, limit, offset}. Reading `.shots` off it is
// undefined on every machine ever built, and the previous skin's numpad fell through to an
// empty array behind a debug-level log.
export function chipCount(response) {
    return response.shots.length;
}

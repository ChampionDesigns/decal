// CANARY — retirement-spelling.
// CB-21: the shots list is {items, total, limit, offset}. Reading `.shots` off it is
// undefined on every machine ever built, and the old skin's numpad fell through to an
// empty array behind a debug-level log.
export function chipCount(response) {
    return response.shots.length;
}

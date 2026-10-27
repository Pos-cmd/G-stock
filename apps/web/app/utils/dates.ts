const pad = (value: number): string => String(value).padStart(2, "0");

/** Valeur d'un `<input type="date">` : le jour local, pas le jour UTC. */
export const toDateInputValue = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Midi local : évite qu'un décalage horaire fasse changer de jour. */
export const fromDateInputValue = (value: string): Date => new Date(`${value}T12:00:00`);

export type EquipmentId = 'barrier' | 'ppe' | 'chainsaw' | 'pump' | 'hose' | 'wet-vac';

export interface EquipmentDef {
  id: EquipmentId;
  name: string;
  /** Nachbereitung an der Werkbank. Fehlt der Eintrag, braucht das Gerät keine Pflege. */
  service?: { label: string; durationMs: number };
  /** Text, wenn das Gerät im Einsatz nicht anspringt, weil die Nachbereitung fehlte. */
  failText?: string;
  /** Dauer der Zusatzaufgabe "Gerät wieder gangbar machen". */
  repairMs?: number;
}

export const EQUIPMENT: Record<EquipmentId, EquipmentDef> = {
  barrier: { id: 'barrier', name: 'Absperrmaterial' },
  ppe: { id: 'ppe', name: 'Schnittschutz-PSA' },
  chainsaw: {
    id: 'chainsaw',
    name: 'Kettensäge',
    service: { label: 'Kettensäge reinigen und tanken', durationMs: 2500 },
    failText: 'Die Kettensäge springt nicht an. Kette verharzt, Tank leer. Das war die fehlende Nachbereitung.',
    repairMs: 8000,
  },
  pump: {
    id: 'pump',
    name: 'Tauchpumpe',
    service: { label: 'Pumpe spülen', durationMs: 2500 },
    failText: 'Die Pumpe läuft nicht an. Laufrad mit Schlamm vom letzten Einsatz verklebt.',
    repairMs: 8000,
  },
  hose: { id: 'hose', name: 'Schlauchmaterial' },
  'wet-vac': {
    id: 'wet-vac',
    name: 'Wassersauger',
    service: { label: 'Wassersauger entleeren', durationMs: 1500 },
    failText: 'Der Wassersauger ist noch voll vom letzten Mal. Erst entleeren.',
    repairMs: 4000,
  },
};

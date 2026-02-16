export interface ReportRow {
    id?: string;
    sabablar: string;
    tovar: number | '';
    rasxod: number | '';
    vazvirat: number | '';
    pul: number | '';
    kilik_ozi: number | '';
}

export const formatNumber = (val: number | string | undefined): string => {
    if (val === '' || val === undefined || val === null) return '';
    const strVal = String(val).replace(/\./g, '');
    const num = Number(strVal);
    if (isNaN(num)) return '';
    return num.toLocaleString('de-DE');
};

export const parseNumber = (val: string): string => val.replace(/\./g, '');

export const calculateItog = (row: ReportRow): number => {
    const tovar = Number(row.tovar) || 0;
    const out = (Number(row.rasxod) || 0) + (Number(row.vazvirat) || 0) + (Number(row.pul) || 0) + (Number(row.kilik_ozi) || 0);
    return tovar - out;
};

export const filterActiveRows = (rows: ReportRow[]): ReportRow[] => {
    return rows.filter(r =>
        r.sabablar.trim() !== '' ||
        r.tovar !== '' || r.rasxod !== '' ||
        r.vazvirat !== '' || r.pul !== '' || r.kilik_ozi !== ''
    );
};

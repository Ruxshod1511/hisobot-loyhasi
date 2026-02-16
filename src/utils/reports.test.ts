import { describe, it, expect } from 'vitest';
import { formatNumber, calculateItog, filterActiveRows, ReportRow } from './reports';

describe('Reports Logic', () => {
    describe('formatNumber', () => {
        it('formats large numbers correctly with dots', () => {
            expect(formatNumber(1000000)).toBe('1.000.000');
            expect(formatNumber(1250)).toBe('1.250');
        });

        it('handles strings properly', () => {
            expect(formatNumber('5000')).toBe('5.000');
        });

        it('returns empty string for empty inputs', () => {
            expect(formatNumber('')).toBe('');
            expect(formatNumber(undefined)).toBe('');
        });
    });

    describe('calculateItog', () => {
        it('correctly subtracts costs from tovar', () => {
            const row: ReportRow = {
                sabablar: 'Test',
                tovar: 1000,
                rasxod: 50,
                vazvirat: 50,
                pul: 200,
                kilik_ozi: 100
            };
            // 1000 - (50+50+200+100) = 1000 - 400 = 600
            expect(calculateItog(row)).toBe(600);
        });

        it('handles missing/empty values as zero', () => {
            const row: ReportRow = {
                sabablar: 'Test',
                tovar: 1000,
                rasxod: '',
                vazvirat: '',
                pul: '',
                kilik_ozi: ''
            };
            expect(calculateItog(row)).toBe(1000);
        });
    });

    describe('filterActiveRows', () => {
        it('removes completely empty rows', () => {
            const rows: ReportRow[] = [
                { sabablar: 'Data', tovar: 100, rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' },
                { sabablar: '', tovar: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }
            ];
            const filtered = filterActiveRows(rows);
            expect(filtered).toHaveLength(1);
            expect(filtered[0].sabablar).toBe('Data');
        });

        it('keeps rows with at least one non-empty field', () => {
            const rows: ReportRow[] = [
                { sabablar: '', tovar: 100, rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }
            ];
            expect(filterActiveRows(rows)).toHaveLength(1);
        });
    });
});

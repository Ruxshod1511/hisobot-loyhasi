import { useEffect, useState, useRef, useMemo, memo } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Trash2, Save, Download, FolderOpen, FilePlus, Search, X, Plus, FileSpreadsheet, CheckSquare, Square } from 'lucide-react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

interface ReportGroup {
    id: string
    name: string
    report_date: string
}

interface ReportRow {
    id?: string
    sabablar: string
    tovar: number | '';
    ok: number | '';
    rasxod: number | '';
    vazvirat: number | '';
    pul: number | '';
    kilik_ozi: number | '';
}

export const Dashboard = () => {
    const { user, signOut } = useAuth()
    const [reportGroups, setReportGroups] = useState<ReportGroup[]>([])
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
    const [rows, setRows] = useState<ReportRow[]>([{ sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }])
    const [loading, setLoading] = useState(true)
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false)
    const [reportName, setReportName] = useState('')
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

    // Selection Marquee State
    const [isSelecting, setIsSelecting] = useState(false)
    const [selectionRect, setSelectionRect] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null)
    const tableBodyRef = useRef<HTMLTableSectionElement>(null)

    const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

    useEffect(() => {
        fetchReportGroups()
    }, [])

    const fetchReportGroups = async () => {
        const { data, error } = await supabase
            .from('report_groups')
            .select('*')
            .order('report_date', { ascending: false })
        if (error) console.error('Error fetching groups:', error)
        else setReportGroups(data || [])
        setLoading(false)
    }

    const loadReport = async (group: ReportGroup) => {
        setLoading(true)
        setActiveGroupId(group.id)
        setReportName(group.name)
        setReportDate(group.report_date)

        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .eq('group_id', group.id)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching reports:', error)
        } else {
            setRows(data.map(r => ({
                id: r.id,
                sabablar: r.sabablar || '',
                tovar: r.tovar || '',
                ok: r.ok || '',
                rasxod: r.rasxod || '',
                vazvirat: r.vazvirat || '',
                pul: r.pul || '',
                kilik_ozi: r.kilik_ozi || ''
            })))
        }
        setIsLoadModalOpen(false)
        setLoading(false)
    }

    const handleNewReport = () => {
        if (rows.some(r => r.sabablar || r.tovar) && !activeGroupId) {
            if (!confirm('Hozirgi saqlanmagan ma\'lumotlar o\'chib ketadi. Davom etamizmi?')) return
        }
        setActiveGroupId(null)
        setRows([{ sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }])
        setReportName('')
        setReportDate(new Date().toISOString().split('T')[0])
    }

    const handleAddMultipleRows = () => {
        const count = prompt('Nechta qator qo\'shmoqchisiz?', '5')
        if (count === null) return
        const num = parseInt(count)
        if (isNaN(num) || num <= 0) return

        const newRowsList: ReportRow[] = Array(num).fill(null).map(() => ({
            sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: ''
        }))
        setRows([...rows, ...newRowsList])
    }

    const toggleSelectRow = (index: number) => {
        const next = new Set(selectedRows)
        if (next.has(index)) next.delete(index)
        else next.add(index)
        setSelectedRows(next)
    }

    const toggleSelectAll = () => {
        if (selectedRows.size === rows.length) {
            setSelectedRows(new Set())
        } else {
            setSelectedRows(new Set(rows.keys()))
        }
    }

    const deleteSelectedRows = () => {
        if (selectedRows.size === 0) return
        if (!confirm(`${selectedRows.size} ta qatorni o'chirishni tasdiqlaysizmi?`)) return

        const newRows = rows.filter((_, index) => !selectedRows.has(index))
        setRows(newRows.length > 0 ? newRows : [{ sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }])
        setSelectedRows(new Set())
    }

    const handleFinalSave = async () => {
        if (!reportName.trim()) {
            alert('Iltimos, hisobot nomini kiriting')
            return
        }

        setLoading(true)
        let groupId = activeGroupId

        if (!groupId) {
            const { data, error } = await supabase
                .from('report_groups')
                .insert([{ name: reportName, report_date: reportDate, user_id: user?.id }])
                .select()
            if (error) {
                console.error('Error creating group:', error)
                setLoading(false)
                return
            }
            groupId = data[0].id
            setActiveGroupId(groupId)
        } else {
            await supabase.from('report_groups').update({ name: reportName, report_date: reportDate }).eq('id', groupId)
        }

        const rowsToSave = rows
            .filter(r => r.sabablar.trim() || r.tovar !== '')
            .map(r => ({
                ...(r.id ? { id: r.id } : {}),
                group_id: groupId,
                user_id: user?.id,
                sabablar: r.sabablar,
                tovar: Number(r.tovar) || 0,
                ok: Number(r.ok) || 0,
                rasxod: Number(r.rasxod) || 0,
                vazvirat: Number(r.vazvirat) || 0,
                pul: Number(r.pul) || 0,
                kilik_ozi: Number(r.kilik_ozi) || 0
            }))

        const { error: upsertError } = await supabase.from('reports').upsert(rowsToSave)

        if (upsertError) {
            console.error('Error saving rows:', upsertError)
        } else {
            fetchReportGroups()
            const { data: freshRows } = await supabase.from('reports').select('*').eq('group_id', groupId).order('created_at', { ascending: true })
            if (freshRows) {
                setRows(freshRows.map(r => ({
                    id: r.id,
                    sabablar: r.sabablar || '',
                    tovar: r.tovar || '',
                    ok: r.ok || '',
                    rasxod: r.rasxod || '',
                    vazvirat: r.vazvirat || '',
                    pul: r.pul || '',
                    kilik_ozi: r.kilik_ozi || ''
                })))
            }
            alert('Muvaffaqiyatli saqlandi!')
        }

        setIsSaveModalOpen(false)
        setLoading(false)
    }

    const calculateItog = (r: ReportRow) => {
        const tovar = Number(r.tovar) || 0
        const subtractions = (Number(r.ok) || 0) +
            (Number(r.rasxod) || 0) +
            (Number(r.vazvirat) || 0) +
            (Number(r.pul) || 0) +
            (Number(r.kilik_ozi) || 0)
        return tovar - subtractions
    }

    const formatNumber = (val: number | string | undefined, suppressZero = true) => {
        if (val === '' || val === undefined || val === null) return ''
        const num = typeof val === 'string' ? Number(val.replace(/\./g, '')) : val
        if (isNaN(num)) return ''
        if (suppressZero && num === 0) return ''
        return num.toLocaleString('de-DE')
    }

    const parseNumber = (val: string) => {
        return val.replace(/\./g, '')
    }

    const getFontSize = (val: any) => {
        const str = String(formatNumber(val, false))
        if (str.length > 18) return '0.7rem'
        if (str.length > 15) return '0.85rem'
        if (str.length > 12) return '1.05rem'
        if (str.length > 10) return '1.25rem'
        return '1.45rem'
    }

    const handleInputChange = (index: number, field: keyof ReportRow, value: any) => {
        const newRows = [...rows]
        if (field !== 'sabablar') {
            const cleanValue = parseNumber(value)
            // Allow empty or numeric-only strings
            if (cleanValue !== '' && isNaN(Number(cleanValue))) return
            // @ts-ignore
            newRows[index][field] = cleanValue
        } else {
            newRows[index][field] = value
        }
        setRows(newRows)
    }

    const handleKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
        const fields = ['sabablar', 'tovar', 'ok', 'rasxod', 'vazvirat', 'pul', 'kilik_ozi']
        const currentIndex = fields.indexOf(field)

        if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
            if (currentIndex < fields.length - 1) {
                // Not the last cell in the row
                if (e.key === 'Enter') e.preventDefault() // Tab already moves focus, but we can override it for consistency if needed
                // If it's Tab, the browser handles focus naturally, but for Enter we must do it manually
                if (e.key === 'Enter') {
                    inputRefs.current[`${index}-${fields[currentIndex + 1]}`]?.focus()
                }
            } else if (index === rows.length - 1) {
                // Last cell in the last row
                e.preventDefault()
                setRows([...rows, { sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }])
                setTimeout(() => {
                    inputRefs.current[`${index + 1}-sabablar`]?.focus()
                }, 10)
            } else {
                // Last cell but not the last row
                if (e.key === 'Enter') {
                    e.preventDefault()
                    inputRefs.current[`${index + 1}-sabablar`]?.focus()
                }
                // Tab handles focus automatically to the next row's first input if structured correctly, 
                // but our refs might be better to ensure consistency.
            }
        }
    }

    const filteredGroups = useMemo(() => {
        return reportGroups.filter(g =>
            g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.report_date.includes(searchQuery)
        )
    }, [reportGroups, searchQuery])

    const exportPDF = () => {
        const doc = new jsPDF()
        doc.setFontSize(22)
        doc.text(reportName || 'Achot Hisoboti', 14, 20)
        doc.setFontSize(12)
        doc.setTextColor(100)
        doc.text(`Sana: ${reportDate}`, 14, 28)
        doc.text(`Foydalanuvchi: ${user?.email}`, 14, 34)

        const tableData = rows
            .filter(r => r.sabablar.trim() || r.tovar !== '')
            .map((r, index) => [
                index + 1,
                r.sabablar,
                formatNumber(r.tovar) || '0',
                formatNumber(r.ok) || '0',
                formatNumber(r.rasxod) || '0',
                formatNumber(r.vazvirat) || '0',
                formatNumber(r.pul) || '0',
                formatNumber(r.kilik_ozi) || '0',
                formatNumber(calculateItog(r))
            ])

        const totalTovar = rows.reduce((acc, r) => acc + (Number(r.tovar) || 0), 0)
        const grandItog = rows.reduce((acc, r) => acc + calculateItog(r), 0)

        // @ts-ignore
        doc.autoTable({
            head: [['N', 'SABABLAR', 'TOVAR', 'OK', 'RASXOD', 'VAZVIRAT', 'PUL', 'KILIK O\'ZI', 'ITOG']],
            body: tableData,
            startY: 45,
            foot: [[
                rows.length,
                'JAMI',
                formatNumber(totalTovar),
                formatNumber(rows.reduce((acc, r) => acc + (Number(r.ok) || 0), 0)),
                formatNumber(rows.reduce((acc, r) => acc + (Number(r.rasxod) || 0), 0)),
                formatNumber(rows.reduce((acc, r) => acc + (Number(r.vazvirat) || 0), 0)),
                formatNumber(rows.reduce((acc, r) => acc + (Number(r.pul) || 0), 0)),
                formatNumber(rows.reduce((acc, r) => acc + (Number(r.kilik_ozi) || 0), 0)),
                formatNumber(grandItog)
            ]],
            theme: 'grid',
            headStyles: { fillColor: [255, 255, 0], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
            footStyles: { fillColor: [252, 213, 180], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
            styles: { fontSize: 10, cellPadding: 3, textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], halign: 'center' },
            columnStyles: {
                1: { halign: 'left' }
            },
            didParseCell: (data: any) => {
                if (data.section === 'body') {
                    if (data.column.index === 1) data.cell.styles.fillColor = [195, 214, 155]; // Sabablar
                    if (data.column.index === 2) data.cell.styles.fillColor = [250, 192, 208]; // Tovar
                    if (data.column.index === 4) data.cell.styles.fillColor = [146, 208, 80];  // Rasxod
                    if (data.column.index === 6) data.cell.styles.fillColor = [0, 176, 240];    // Pul
                }
                if (data.section === 'foot' && data.column.index === 0) {
                    data.cell.styles.textColor = [239, 68, 68]; // Red for N in footer
                }
            }
        })

        doc.save(`${reportName || 'hisobot'}-${reportDate}.pdf`)
    }

    const exportExcel = () => {
        const totalTovar = rows.reduce((acc, r) => acc + (Number(r.tovar) || 0), 0)
        const totalOk = rows.reduce((acc, r) => acc + (Number(r.ok) || 0), 0)
        const totalRasxod = rows.reduce((acc, r) => acc + (Number(r.rasxod) || 0), 0)
        const totalVazvirat = rows.reduce((acc, r) => acc + (Number(r.vazvirat) || 0), 0)
        const totalPul = rows.reduce((acc, r) => acc + (Number(r.pul) || 0), 0)
        const totalKilik = rows.reduce((acc, r) => acc + (Number(r.kilik_ozi) || 0), 0)

        // Creating a temporary HTML table for styling preservation in Excel
        const tableHtml = `
            <table border="1">
                <thead>
                    <tr style="background-color: #ffff00; font-weight: bold;">
                        <th>N</th>
                        <th>SABABLAR</th>
                        <th>TOVAR</th>
                        <th>OK</th>
                        <th>RASXOD</th>
                        <th>VAZVIRAT</th>
                        <th>PUL</th>
                        <th>KILIK O'ZI</th>
                        <th>ITOG</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.filter(r => r.sabablar.trim() || r.tovar !== '').map((r, index) => `
                        <tr>
                            <td align="center">${index + 1}</td>
                            <td style="background-color: #c3d69b;">${r.sabablar}</td>
                            <td style="background-color: #fac0d0;" align="center">${formatNumber(r.tovar)}</td>
                            <td align="center">${formatNumber(r.ok)}</td>
                            <td style="background-color: #92d050;" align="center">${formatNumber(r.rasxod)}</td>
                            <td align="center">${formatNumber(r.vazvirat)}</td>
                            <td style="background-color: #00b0f0;" align="center">${formatNumber(r.pul)}</td>
                            <td align="center">${formatNumber(r.kilik_ozi)}</td>
                            <td style="background-color: #ffff00; font-weight: bold;" align="center">${formatNumber(calculateItog(r))}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background-color: #fcd5b4; font-weight: bold;">
                        <td align="center">${rows.length}</td>
                        <td align="center">JAMI</td>
                        <td align="center">${formatNumber(totalTovar)}</td>
                        <td align="center">${formatNumber(totalOk)}</td>
                        <td align="center">${formatNumber(totalRasxod)}</td>
                        <td align="center">${formatNumber(totalVazvirat)}</td>
                        <td align="center">${formatNumber(totalPul)}</td>
                        <td align="center">${formatNumber(totalKilik)}</td>
                        <td align="center">${formatNumber(grandItog)}</td>
                    </tr>
                </tfoot>
            </table>
        `

        const blob = new Blob([`
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Achot</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
            <body>${tableHtml}</body>
            </html>
        `], { type: 'application/vnd.ms-excel' })

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportName || 'hisobot'}-${reportDate}.xls`
        a.click()
        URL.revokeObjectURL(url)
    }

    const grandItog = useMemo(() => rows.reduce((acc, r) => acc + calculateItog(r), 0), [rows])

    const handleSelectionStart = (e: React.MouseEvent) => {
        if (e.button !== 0) return // Only left click
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.closest('.action-button') || target.closest('.icon-btn') || target.closest('.custom-checkbox')) return

        const rect = tableBodyRef.current?.getBoundingClientRect()
        if (!rect) return

        setIsSelecting(true)
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        setSelectionRect({ x1: x, y1: y, x2: x, y2: y })
        if (!e.ctrlKey && !e.shiftKey) setSelectedRows(new Set())
    }

    const handleSelectionMove = (e: React.MouseEvent) => {
        if (!isSelecting || !selectionRect) return
        const rect = tableBodyRef.current?.getBoundingClientRect()
        if (!rect) return

        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        setSelectionRect({ ...selectionRect, x2: x, y2: y })

        // Calculate intersection
        const xMin = Math.min(selectionRect.x1, x)
        const xMax = Math.max(selectionRect.x1, x)
        const yMin = Math.min(selectionRect.y1, y)
        const yMax = Math.max(selectionRect.y1, y)

        const newSelected = new Set(selectedRows)
        const rowsElements = tableBodyRef.current?.querySelectorAll('tr')
        rowsElements?.forEach((tr, index) => {
            const trRect = {
                top: tr.offsetTop,
                bottom: tr.offsetTop + tr.offsetHeight,
                left: tr.offsetLeft,
                right: tr.offsetLeft + tr.offsetWidth
            }

            const isIntersecting = !(xMin > trRect.right || xMax < trRect.left || yMin > trRect.bottom || yMax < trRect.top)

            if (isIntersecting) newSelected.add(index)
            else if (!e.ctrlKey) newSelected.delete(index)
        })
        setSelectedRows(newSelected)
    }

    const handleSelectionEnd = () => {
        setIsSelecting(false)
        setSelectionRect(null)
    }

    return (
        <div className={`dashboard-container ${isSelecting ? 'is-selecting' : ''}`}>
            <header className="header">
                <div className="title-group">
                    <h1>{activeGroupId ? reportName : 'Yangi Hisobot'}</h1>
                    <p className="user-email">{user?.email}</p>
                </div>
                <div className="actions">
                    <button onClick={handleNewReport} className="action-button">
                        <FilePlus size={20} /> Yangi
                    </button>
                    <button onClick={handleAddMultipleRows} className="action-button">
                        <Plus size={20} /> Qator qo'shish
                    </button>
                    <button onClick={() => { fetchReportGroups(); setIsLoadModalOpen(true); }} className="action-button">
                        <FolderOpen size={20} /> Ochish
                    </button>
                    <button onClick={() => setIsSaveModalOpen(true)} className="action-button save-btn">
                        <Save size={20} /> Saqlash
                    </button>
                    <button onClick={exportPDF} className="action-button">
                        <Download size={20} /> PDF
                    </button>
                    <button onClick={exportExcel} className="action-button excel-btn">
                        <FileSpreadsheet size={20} /> Excel
                    </button>
                    {selectedRows.size > 0 && (
                        <button onClick={deleteSelectedRows} className="action-button delete-selected-btn">
                            <Trash2 size={20} /> O'chirish ({selectedRows.size})
                        </button>
                    )}
                    <button onClick={signOut} className="action-button logout-btn" title="Chiqish">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <div className="table-wrapper">
                {loading ? (
                    <div className="loading-state" style={{ padding: '4rem', textAlign: 'center', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                        Yuklanmoqda...
                    </div>
                ) : (
                    <>
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>
                                        <div className="custom-checkbox" onClick={toggleSelectAll}>
                                            {selectedRows.size === rows.length ? <CheckSquare size={20} /> : <Square size={20} />}
                                        </div>
                                    </th>
                                    <th style={{ width: '60px' }}>N</th>
                                    <th style={{ textAlign: 'left' }}>SABABLAR</th>
                                    <th>TOVAR</th>
                                    <th>OK</th>
                                    <th>RASXOD</th>
                                    <th>VAZVIRAT</th>
                                    <th>PUL</th>
                                    <th>KILIK O'ZI</th>
                                    <th>ITOG</th>
                                    <th style={{ width: '80px' }}></th>
                                </tr>
                            </thead>
                            <tbody
                                ref={tableBodyRef}
                                onMouseDown={handleSelectionStart}
                                onMouseMove={handleSelectionMove}
                                onMouseUp={handleSelectionEnd}
                                onMouseLeave={handleSelectionEnd}
                                style={{ position: 'relative' }}
                            >
                                {isSelecting && selectionRect && (
                                    <div
                                        className="selection-marquee"
                                        style={{
                                            left: Math.min(selectionRect.x1, selectionRect.x2),
                                            top: Math.min(selectionRect.y1, selectionRect.y2),
                                            width: Math.abs(selectionRect.x2 - selectionRect.x1),
                                            height: Math.abs(selectionRect.y2 - selectionRect.y1)
                                        }}
                                    />
                                )}
                                {rows.map((row, index) => (
                                    <TableRow
                                        key={index}
                                        index={index}
                                        row={row}
                                        isSelected={selectedRows.has(index)}
                                        onToggleSelect={toggleSelectRow}
                                        onInputChange={handleInputChange}
                                        onKeyDown={handleKeyDown}
                                        onDelete={() => {
                                            if (rows.length > 1) setRows(rows.filter((_, i) => i !== index))
                                            else setRows([{ sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }])
                                        }}
                                        getFontSize={getFontSize}
                                        formatNumber={formatNumber}
                                        calculateItog={calculateItog}
                                        inputRefs={inputRefs}
                                    />
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="grand-total">
                                    <td colSpan={2}>{rows.length}</td>
                                    <td style={{ textAlign: 'center' }}>JAMI</td>
                                    <td>{formatNumber(rows.reduce((acc, r) => acc + (Number(r.tovar) || 0), 0))}</td>
                                    <td>{formatNumber(rows.reduce((acc, r) => acc + (Number(r.ok) || 0), 0))}</td>
                                    <td>{formatNumber(rows.reduce((acc, r) => acc + (Number(r.rasxod) || 0), 0))}</td>
                                    <td>{formatNumber(rows.reduce((acc, r) => acc + (Number(r.vazvirat) || 0), 0))}</td>
                                    <td>{formatNumber(rows.reduce((acc, r) => acc + (Number(r.pul) || 0), 0))}</td>
                                    <td>{formatNumber(rows.reduce((acc, r) => acc + (Number(r.kilik_ozi) || 0), 0))}</td>
                                    <td className="itog-val">{formatNumber(grandItog, false)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>

                        <div className="itog-footer">
                            <div className="total-label-box">
                                <span>ITOG</span>
                                <span style={{ fontSize: getFontSize(grandItog) }}>{formatNumber(grandItog, false)}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {isSaveModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Hisobotni Saqlash</h2>
                        <div className="input-group">
                            <label>Hisobot Nomi:</label>
                            <input
                                type="text"
                                value={reportName}
                                onChange={e => setReportName(e.target.value)}
                                placeholder="Masalan: Fevral achoti"
                                autoFocus
                            />
                        </div>
                        <div className="input-group">
                            <label>Sana:</label>
                            <input
                                type="date"
                                value={reportDate}
                                onChange={e => setReportDate(e.target.value)}
                            />
                        </div>
                        <div className="modal-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button onClick={() => setIsSaveModalOpen(false)} className="action-button" style={{ flex: 1, justifyContent: 'center' }}>Bekor qilish</button>
                            <button onClick={handleFinalSave} className="action-button save-btn" style={{ flex: 1, justifyContent: 'center' }}>Saqlash</button>
                        </div>
                    </div>
                </div>
            )}

            {isLoadModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2>Saqlangan Hisobotlar</h2>
                            <button className="icon-btn" onClick={() => setIsLoadModalOpen(false)}><X size={24} /></button>
                        </div>

                        <div className="search-box" style={{ position: 'relative' }}>
                            <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input
                                type="text"
                                placeholder="Qidirish..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ width: '100%', paddingLeft: '3rem', background: '#f1f5f9', border: 'none', borderRadius: '1rem', height: '3.5rem', fontWeight: 600 }}
                            />
                        </div>

                        <div className="report-list" style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.5rem' }}>
                            {filteredGroups.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>Hisobotlar topilmadi.</p>
                            ) : (
                                filteredGroups.map(group => (
                                    <div
                                        key={group.id}
                                        className="report-item"
                                        onClick={() => loadReport(group)}
                                    >
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div style={{ background: 'var(--primary)', color: 'white', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FolderOpen size={20} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{group.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>{group.report_date}</div>
                                            </div>
                                        </div>
                                        <button
                                            className="icon-btn"
                                            style={{ color: 'var(--error)' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm('Ushbu hisobotni butunlay o\'chirmoqchimisiz?')) {
                                                    supabase.from('report_groups').delete().eq('id', group.id).then(() => fetchReportGroups())
                                                }
                                            }}
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Memoized TableRow component for performance
const TableRow = memo(({
    index,
    row,
    isSelected,
    onToggleSelect,
    onInputChange,
    onKeyDown,
    onDelete,
    getFontSize,
    formatNumber,
    calculateItog,
    inputRefs
}: any) => {
    // Local state for fast typing
    const [localRow, setLocalRow] = useState(row)

    useEffect(() => {
        setLocalRow(row)
    }, [row])

    const handleChange = (field: string, value: string) => {
        const nextLocal = { ...localRow, [field]: value }
        setLocalRow(nextLocal)
        // Sync to parent
        onInputChange(index, field, value)
    }

    return (
        <tr className={isSelected ? 'row-selected' : ''}>
            <td>
                <div className="custom-checkbox" onClick={() => onToggleSelect(index)}>
                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
            </td>
            <td>{index + 1}</td>
            <td className="sabablar-cell">
                <input
                    ref={el => inputRefs.current[`${index}-sabablar`] = el}
                    value={localRow.sabablar}
                    onChange={e => handleChange('sabablar', e.target.value)}
                    onKeyDown={e => onKeyDown(e, index, 'sabablar')}
                    placeholder=""
                />
            </td>
            <td className="tovar-cell">
                <input
                    type="text"
                    ref={el => inputRefs.current[`${index}-tovar`] = el}
                    value={formatNumber(localRow.tovar)}
                    onChange={e => handleChange('tovar', e.target.value)}
                    onKeyDown={e => onKeyDown(e, index, 'tovar')}
                    placeholder=""
                    style={{ fontSize: getFontSize(localRow.tovar) }}
                />
            </td>
            <td className="ok-cell">
                <input
                    type="text"
                    ref={el => inputRefs.current[`${index}-ok`] = el}
                    value={formatNumber(localRow.ok)}
                    onChange={e => handleChange('ok', e.target.value)}
                    onKeyDown={e => onKeyDown(e, index, 'ok')}
                    placeholder="0"
                    style={{ fontSize: getFontSize(localRow.ok) }}
                />
            </td>
            <td className="rasxod-cell">
                <input
                    type="text"
                    ref={el => inputRefs.current[`${index}-rasxod`] = el}
                    value={formatNumber(localRow.rasxod)}
                    onChange={e => handleChange('rasxod', e.target.value)}
                    onKeyDown={e => onKeyDown(e, index, 'rasxod')}
                    placeholder="0"
                    style={{ fontSize: getFontSize(localRow.rasxod) }}
                />
            </td>
            <td className="vazvirat-cell">
                <input
                    type="text"
                    ref={el => inputRefs.current[`${index}-vazvirat`] = el}
                    value={formatNumber(localRow.vazvirat)}
                    onChange={e => handleChange('vazvirat', e.target.value)}
                    onKeyDown={e => onKeyDown(e, index, 'vazvirat')}
                    placeholder="0"
                    style={{ fontSize: getFontSize(localRow.vazvirat) }}
                />
            </td>
            <td className="pul-cell">
                <input
                    type="text"
                    ref={el => inputRefs.current[`${index}-pul`] = el}
                    value={formatNumber(localRow.pul)}
                    onChange={e => handleChange('pul', e.target.value)}
                    onKeyDown={e => onKeyDown(e, index, 'pul')}
                    placeholder="0"
                    style={{ fontSize: getFontSize(localRow.pul) }}
                />
            </td>
            <td className="kilik-cell">
                <input
                    type="text"
                    ref={el => inputRefs.current[`${index}-kilik_ozi`] = el}
                    value={formatNumber(localRow.kilik_ozi)}
                    onChange={e => handleChange('kilik_ozi', e.target.value)}
                    onKeyDown={e => onKeyDown(e, index, 'kilik_ozi')}
                    placeholder="0"
                    style={{ fontSize: getFontSize(localRow.kilik_ozi) }}
                />
            </td>
            <td className="itog-val" style={{ fontSize: getFontSize(calculateItog(localRow)) }}>
                {formatNumber(calculateItog(localRow))}
            </td>
            <td>
                <button className="icon-btn delete" onClick={onDelete} title="O'chirish">
                    <Trash2 size={20} />
                </button>
            </td>
        </tr>
    )
})

export default Dashboard

import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Trash2, Save, Download, FolderOpen, FilePlus, Search, X } from 'lucide-react'
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

const Dashboard = () => {
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
            alert(`Yuklashda xatolik: ${error.message}`)
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
        if (rows.some(r => r.sabablar || r.tovar !== '') && !activeGroupId) {
            if (!confirm('Hozirgi saqlanmagan ma\'lumotlar o\'chib ketadi. Davom etamizmi?')) return
        }
        setActiveGroupId(null)
        setRows([{ sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }])
        setReportName('')
        setReportDate(new Date().toISOString().split('T')[0])
        setTimeout(() => inputRefs.current[`0-sabablar`]?.focus(), 10)
    }

    const handleFinalSave = async () => {
        if (!reportName.trim()) {
            alert('Iltimos, hisobot nomini kiriting')
            return
        }

        setLoading(true)
        try {
            let groupId = activeGroupId

            if (!groupId) {
                const { data, error: groupInsertError } = await supabase
                    .from('report_groups')
                    .insert([{ name: reportName, report_date: reportDate, user_id: user?.id }])
                    .select()
                if (groupInsertError) throw groupInsertError
                if (!data || data.length === 0) throw new Error('Hisobot guruhi yaratilmadi')
                groupId = data[0].id
                setActiveGroupId(groupId)
            } else {
                const { error: groupUpdateError } = await supabase
                    .from('report_groups')
                    .update({ name: reportName, report_date: reportDate })
                    .eq('id', groupId)
                if (groupUpdateError) throw groupUpdateError
            }

            // Sync reports: delete old and insert current state
            const { error: deleteError } = await supabase.from('reports').delete().eq('group_id', groupId)
            if (deleteError) console.error('Delete error (safe to ignore if new):', deleteError)

            const rowsToSave = rows
                .filter(r => r.sabablar.trim() || r.tovar !== '')
                .map(r => ({
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

            if (rowsToSave.length > 0) {
                const { error: insertError } = await supabase.from('reports').insert(rowsToSave)
                if (insertError) throw insertError

                // Refresh data to get IDs back
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
            }

            fetchReportGroups()
            alert('Muvaffaqiyatli saqlandi!')
            setIsSaveModalOpen(false)
        } catch (e: any) {
            alert(`Saqlashda xatolik: ${e.message}`)
            console.error('Save error:', e)
        } finally {
            setLoading(false)
        }
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

    const handleInputChange = (index: number, field: keyof ReportRow, value: string) => {
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
                if (e.key === 'Enter') {
                    e.preventDefault()
                    inputRefs.current[`${index}-${fields[currentIndex + 1]}`]?.focus()
                }
            } else if (index === rows.length - 1) {
                e.preventDefault()
                setRows([...rows, { sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }])
                setTimeout(() => {
                    inputRefs.current[`${index + 1}-sabablar`]?.focus()
                }, 10)
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                inputRefs.current[`${index + 1}-sabablar`]?.focus()
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

        // Use component-level totals
        const grandItog = formatNumber(grandItogValue)

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
                grandItog
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

        // @ts-ignore
        const finalY = doc.lastAutoTable.finalY || 150

        doc.setLineWidth(0.5)
        doc.setDrawColor(0, 0, 0)
        doc.setFillColor(255, 255, 0)
        doc.rect(14, finalY + 10, 80, 15, 'FD')

        doc.setFontSize(20)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 0, 0)
        doc.text('ITOG', 20, finalY + 20)
        doc.text(grandItog, 55, finalY + 20)

        doc.save(`${reportName || 'hisobot'}-${reportDate}.pdf`)
    }

    const totalTovar = rows.reduce((acc, r) => acc + (Number(r.tovar) || 0), 0)
    const grandItogValue = rows.reduce((acc, r) => acc + calculateItog(r), 0)

    return (
        <div className="dashboard-container">
            <header className="header">
                <div className="title-group">
                    <h1>{activeGroupId ? reportName : 'Yangi Hisobot'}</h1>
                    <p className="user-email">{user?.email}</p>
                </div>
                <div className="actions">
                    <button onClick={handleNewReport} className="action-button">
                        <FilePlus size={20} /> Yangi
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
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td className="sabablar-cell">
                                            <input
                                                ref={el => inputRefs.current[`${index}-sabablar`] = el}
                                                value={row.sabablar}
                                                onChange={e => handleInputChange(index, 'sabablar', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index, 'sabablar')}
                                                placeholder=""
                                            />
                                        </td>
                                        <td className="tovar-cell">
                                            <input
                                                type="text"
                                                ref={el => inputRefs.current[`${index}-tovar`] = el}
                                                value={formatNumber(row.tovar)}
                                                onChange={e => handleInputChange(index, 'tovar', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index, 'tovar')}
                                                placeholder=""
                                            />
                                        </td>
                                        <td className="ok-cell">
                                            <input
                                                type="text"
                                                ref={el => inputRefs.current[`${index}-ok`] = el}
                                                value={formatNumber(row.ok)}
                                                onChange={e => handleInputChange(index, 'ok', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index, 'ok')}
                                                placeholder=""
                                            />
                                        </td>
                                        <td className="rasxod-cell">
                                            <input
                                                type="text"
                                                ref={el => inputRefs.current[`${index}-rasxod`] = el}
                                                value={formatNumber(row.rasxod)}
                                                onChange={e => handleInputChange(index, 'rasxod', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index, 'rasxod')}
                                                placeholder=""
                                            />
                                        </td>
                                        <td className="vazvirat-cell">
                                            <input
                                                type="text"
                                                ref={el => inputRefs.current[`${index}-vazvirat`] = el}
                                                value={formatNumber(row.vazvirat)}
                                                onChange={e => handleInputChange(index, 'vazvirat', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index, 'vazvirat')}
                                                placeholder=""
                                            />
                                        </td>
                                        <td className="pul-cell">
                                            <input
                                                type="text"
                                                ref={el => inputRefs.current[`${index}-pul`] = el}
                                                value={formatNumber(row.pul)}
                                                onChange={e => handleInputChange(index, 'pul', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index, 'pul')}
                                                placeholder=""
                                            />
                                        </td>
                                        <td className="kilik-cell">
                                            <input
                                                type="text"
                                                ref={el => inputRefs.current[`${index}-kilik_ozi`] = el}
                                                value={formatNumber(row.kilik_ozi)}
                                                onChange={e => handleInputChange(index, 'kilik_ozi', e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index, 'kilik_ozi')}
                                                placeholder=""
                                            />
                                        </td>
                                        <td className="itog-val">{formatNumber(calculateItog(row))}</td>
                                        <td>
                                            <button
                                                className="icon-btn delete"
                                                onClick={() => {
                                                    if (rows.length > 1) setRows(rows.filter((_, i) => i !== index))
                                                    else setRows([{ sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }])
                                                }}
                                                title="O'chirish"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="grand-total">
                                    <td>{rows.length}</td>
                                    <td style={{ textAlign: 'center' }}>JAMI</td>
                                    <td>{formatNumber(totalTovar)}</td>
                                    <td>{formatNumber(rows.reduce((acc, r) => acc + (Number(r.ok) || 0), 0))}</td>
                                    <td>{formatNumber(rows.reduce((acc, r) => acc + (Number(r.rasxod) || 0), 0))}</td>
                                    <td>{formatNumber(rows.reduce((acc, r) => acc + (Number(r.vazvirat) || 0), 0))}</td>
                                    <td>{formatNumber(rows.reduce((acc, r) => acc + (Number(r.pul) || 0), 0))}</td>
                                    <td>{formatNumber(rows.reduce((acc, r) => acc + (Number(r.kilik_ozi) || 0), 0))}</td>
                                    <td className="itog-val">{formatNumber(grandItogValue, false)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>

                        <div className="itog-footer">
                            <div className="total-label-box">
                                <span>ITOG</span>
                                <span>{formatNumber(grandItogValue, false)}</span>
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

export default Dashboard

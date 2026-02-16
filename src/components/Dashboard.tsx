import { useEffect, useState, useRef, useMemo, memo, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import {
    LogOut, Trash2, Save, Download, FolderOpen,
    FilePlus, Search, X, Plus, FileSpreadsheet,
    CheckSquare, Square, ChevronLeft, ChevronRight,
    Moon, Sun, Info, CheckCircle2, AlertCircle
} from 'lucide-react'

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

interface ToastMessage {
    id: number
    text: string
    type: 'success' | 'error' | 'info'
}

const DASHBOARD_FIELDS = ['sabablar', 'tovar', 'ok', 'rasxod', 'vazvirat', 'pul', 'kilik_ozi']

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
    const [toasts, setToasts] = useState<ToastMessage[]>([])
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false)
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
    const [isOnline, setIsOnline] = useState(navigator.onLine)

    // UI states
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [numRowsToAdd, setNumRowsToAdd] = useState<number>(10)
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        return (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
    })

    // Selection Marquee State
    const [isSelecting, setIsSelecting] = useState(false)
    const [selectionRect, setSelectionRect] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null)
    const [initialSelectedRows, setInitialSelectedRows] = useState<Set<number>>(new Set())
    const tableContainerRef = useRef<HTMLDivElement>(null)
    const tableBodyRef = useRef<HTMLTableSectionElement>(null)
    const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})
    const scrollInterval = useRef<any>(null)

    useEffect(() => {
        fetchReportGroups()
        document.body.classList.toggle('dark', theme === 'dark')
        localStorage.setItem('theme', theme)
    }, [theme])

    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        // Restore draft from localStorage on mount
        const draft = localStorage.getItem('dashboard_draft')
        if (draft) {
            try {
                const { rows: savedRows, reportName: savedName, reportDate: savedDate, activeGroupId: savedGroupId } = JSON.parse(draft)
                if (savedRows && savedRows.length > 0) setRows(savedRows)
                if (savedName) setReportName(savedName)
                if (savedDate) setReportDate(savedDate)
                if (savedGroupId) setActiveGroupId(savedGroupId)
                setHasUnsavedChanges(true)
            } catch (e) {
                console.error('Draftni tiklashda xatolik:', e)
            }
        }

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    useEffect(() => {
        if (hasUnsavedChanges) {
            const draftData = { rows, reportName, reportDate, activeGroupId }
            localStorage.setItem('dashboard_draft', JSON.stringify(draftData))
        } else {
            localStorage.removeItem('dashboard_draft')
        }
    }, [rows, reportName, reportDate, activeGroupId, hasUnsavedChanges])

    const addToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, text, type }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
    }

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault()
                e.returnValue = ''
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [hasUnsavedChanges])

    const fetchReportGroups = async () => {
        const { data, error } = await supabase
            .from('report_groups')
            .select('*')
            .order('report_date', { ascending: false })
        if (error) {
            console.error('Error fetching groups:', error)
            addToast('Ma\'lumotlarni yuklashda xatolik', 'error')
        } else {
            setReportGroups(data || [])
        }
        setLoading(false)
    }

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light')

    const loadReport = async (group: ReportGroup) => {
        if (hasUnsavedChanges) {
            setPendingAction(() => () => executeLoadReport(group))
            setIsUnsavedModalOpen(true)
            return
        }
        executeLoadReport(group)
    }

    const executeLoadReport = async (group: ReportGroup) => {
        setLoading(true)
        setActiveGroupId(group.id)
        setReportName(group.name)
        setReportDate(group.report_date)

        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .eq('group_id', group.id)
            .order('created_at', { ascending: true })

        if (!error) {
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
            setHasUnsavedChanges(false)
            addToast('Hisobot yuklandi', 'success')
        } else {
            addToast('Hisobotni yuklashda xatolik', 'error')
        }
        setIsLoadModalOpen(false)
        setLoading(false)
    }

    const handleNewReport = () => {
        if (hasUnsavedChanges) {
            setPendingAction(() => () => {
                setActiveGroupId(null)
                setRows([{ sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }])
                setReportName('')
                setReportDate(new Date().toISOString().split('T')[0])
                setSelectedRows(new Set())
                setHasUnsavedChanges(false)
                addToast('Yangi hisobot tayyor', 'info')
            })
            setIsUnsavedModalOpen(true)
            return
        }
        setActiveGroupId(null)
        setRows([{ sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }])
        setReportName('')
        setReportDate(new Date().toISOString().split('T')[0])
        setSelectedRows(new Set())
        setHasUnsavedChanges(false)
        addToast('Yangi hisobot tayyor', 'info')
    }

    const handleBulkAddRows = () => {
        const newRowsList: ReportRow[] = Array(numRowsToAdd).fill(null).map(() => ({
            sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: ''
        }))
        setRows(prev => [...prev, ...newRowsList])
        setHasUnsavedChanges(true)
        addToast(`${numRowsToAdd} ta qator qo'shildi`, 'success')
    }

    const handleFinalSave = async () => {
        if (!reportName.trim()) { addToast('Iltimos, hisobot nomini kiriting', 'error'); return; }
        setLoading(true)
        let groupId = activeGroupId

        if (!groupId) {
            const { data, error } = await supabase.from('report_groups').insert([{ name: reportName, report_date: reportDate, user_id: user?.id }]).select()
            if (error) { addToast('Xatolik yuz berdi', 'error'); setLoading(false); return; }
            groupId = data[0].id
            setActiveGroupId(groupId)
        } else {
            await supabase.from('report_groups').update({ name: reportName, report_date: reportDate }).eq('id', groupId)
        }

        const rowsToSave = rows.filter(r =>
            r.sabablar.trim() !== '' ||
            r.tovar !== '' || r.ok !== '' || r.rasxod !== '' ||
            r.vazvirat !== '' || r.pul !== '' || r.kilik_ozi !== ''
        ).map(r => ({
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
        if (!upsertError) {
            setHasUnsavedChanges(false)
            localStorage.removeItem('dashboard_draft')
            fetchReportGroups()
            addToast('Muvaffaqiyatli saqlandi!', 'success')
            setIsSaveModalOpen(false)
        } else {
            addToast('Saqlashda xatolik', 'error')
        }
        setIsSaveModalOpen(false)
        setLoading(false)
    }

    const formatNumber = (val: number | string | undefined) => {
        if (val === '' || val === undefined || val === null) return ''
        const strVal = String(val).replace(/\./g, '')
        const num = Number(strVal)
        if (isNaN(num)) return ''
        return num.toLocaleString('de-DE')
    }

    const parseNumber = (val: string) => val.replace(/\./g, '')

    const calculateItog = (row: ReportRow) => {
        const tovar = Number(row.tovar) || 0
        const out = (Number(row.ok) || 0) + (Number(row.rasxod) || 0) + (Number(row.vazvirat) || 0) + (Number(row.pul) || 0) + (Number(row.kilik_ozi) || 0)
        return tovar - out
    }

    const handleInputChange = useCallback((index: number, field: keyof ReportRow, value: any) => {
        setRows(prev => {
            const newRows = [...prev]
            const row = { ...newRows[index] }
            if (field !== 'sabablar') {
                const cleanValue = parseNumber(value)
                if (cleanValue !== '' && isNaN(Number(cleanValue))) {
                    return prev
                }
                (row as any)[field] = cleanValue === '' ? '' : cleanValue
            } else {
                row[field] = value
            }
            newRows[index] = row
            setHasUnsavedChanges(true)
            return newRows
        })
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
        const fieldIndex = DASHBOARD_FIELDS.indexOf(field)
        if (e.key === 'ArrowRight' && fieldIndex < DASHBOARD_FIELDS.length - 1) {
            inputRefs.current[`${index}-${DASHBOARD_FIELDS[fieldIndex + 1]}`]?.focus()
        } else if (e.key === 'ArrowLeft' && fieldIndex > 0) {
            inputRefs.current[`${index}-${DASHBOARD_FIELDS[fieldIndex - 1]}`]?.focus()
        } else if (e.key === 'ArrowDown') {
            if (index < rows.length - 1) {
                inputRefs.current[`${index + 1}-${field}`]?.focus()
            }
        } else if (e.key === 'ArrowUp') {
            if (index > 0) {
                inputRefs.current[`${index - 1}-${field}`]?.focus()
            }
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (index === rows.length - 1) {
                setRows(prev => [...prev, { sabablar: '', tovar: '', ok: '', rasxod: '', vazvirat: '', pul: '', kilik_ozi: '' }])
                setHasUnsavedChanges(true)
                setTimeout(() => inputRefs.current[`${index + 1}-sabablar`]?.focus(), 10)
            } else {
                inputRefs.current[`${index + 1}-sabablar`]?.focus()
            }
        }
    }

    const exportPDF = async () => {
        const { default: jsPDF } = await import('jspdf')
        const { default: autoTable } = await import('jspdf-autotable')
        const doc = new jsPDF('l', 'mm', 'a4')
        doc.setFontSize(22)
        doc.setTextColor(30, 41, 59)
        doc.text(reportName || 'Achot Hisoboti', 14, 20)
        doc.setFontSize(10)
        doc.text(`Sana: ${reportDate}`, 14, 28)

        const filtered = rows.filter(r =>
            r.sabablar.trim() !== '' ||
            r.tovar !== '' || r.ok !== '' || r.rasxod !== '' ||
            r.vazvirat !== '' || r.pul !== '' || r.kilik_ozi !== ''
        )
        const tableData = filtered.map((r, index) => [
            index + 1, r.sabablar, '', formatNumber(r.tovar) || '0', formatNumber(r.ok) || '0',
            formatNumber(r.rasxod) || '0', formatNumber(r.vazvirat) || '0', formatNumber(r.pul) || '0',
            formatNumber(r.kilik_ozi) || '0'
        ])

        autoTable(doc, {
            head: [['N', 'SABABLAR', 'BELGI', 'TOVAR', 'OK', 'RASXOD', 'VAZVIRAT', 'PUL', 'KILIK O\'ZI']],
            body: tableData,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [219, 234, 254], textColor: 0, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 8, cellPadding: 3, halign: 'center', valign: 'middle' },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 60, halign: 'left' },
                2: { cellWidth: 15 }
            },
            didDrawPage: (data) => {
                const totalI = filtered.reduce((acc, r) => acc + calculateItog(r), 0)
                doc.setFontSize(10)
                doc.setTextColor(0)
                const finalY = (data as any).cursor.y || 40
                doc.text(`JAMI HAQQI (ITOG): ${formatNumber(totalI)}`, 14, finalY + 10)
            }
        })
        doc.save(`${reportName}-${reportDate}.pdf`)
        addToast('PDF Tayyor', 'success')
    }

    const exportExcel = () => {
        const filteredRows = rows.filter(r =>
            r.sabablar.trim() !== '' ||
            r.tovar !== '' || r.ok !== '' || r.rasxod !== '' ||
            r.vazvirat !== '' || r.pul !== '' || r.kilik_ozi !== ''
        )
        const totalT = filteredRows.reduce((acc, r) => acc + (Number(r.tovar) || 0), 0)
        const totalO = filteredRows.reduce((acc, r) => acc + (Number(r.ok) || 0), 0)
        const totalR = filteredRows.reduce((acc, r) => acc + (Number(r.rasxod) || 0), 0)
        const totalV = filteredRows.reduce((acc, r) => acc + (Number(r.vazvirat) || 0), 0)
        const totalP = filteredRows.reduce((acc, r) => acc + (Number(r.pul) || 0), 0)
        const totalK = filteredRows.reduce((acc, r) => acc + (Number(r.kilik_ozi) || 0), 0)
        const totalI = filteredRows.reduce((acc, r) => acc + calculateItog(r), 0)

        const tableHtml = `
            <table border="1" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;width:100%;">
                <thead>
                    <tr>
                        <th colspan="9" style="font-size:24px;height:70px;background:#f8fafc;color:#1e293b;vertical-align:middle;text-align:center;border-bottom:2px solid #e2e8f0;">
                            ${reportName || 'HISOBOT'}
                        </th>
                    </tr>
                    <tr>
                        <th colspan="9" style="font-size:14px;height:30px;background:#ffffff;color:#64748b;text-align:center;">
                            Sana: ${reportDate}
                        </th>
                    </tr>
                    <tr style="background:#f1f5f9;color:#0f172a;font-weight:bold;height:40px;">
                        <th width="50">№</th>
                        <th width="300" style="text-align:left;padding-left:10px;">SABABLAR</th>
                        <th width="80">BELGI</th>
                        <th width="120">TOVAR</th>
                        <th width="120">OK</th>
                        <th width="120">RASXOD</th>
                        <th width="120">VAZVIRAT</th>
                        <th width="120">PUL</th>
                        <th width="120">KILIK O'ZI</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredRows.map((r, i) => `
                        <tr style="height:32px;">
                            <td align="center" style="background:#f8fafc;color:#64748b;">${i + 1}</td>
                            <td style="padding:0 12px;background:#ffffff;">${r.sabablar}</td>
                            <td style="background:#ffffff;"></td>
                            <td align="center" style="background:#fff7f7;font-weight:bold;color:#b91c1c;">${formatNumber(r.tovar)}</td>
                            <td align="center" style="background:#ffffff;">${formatNumber(r.ok)}</td>
                            <td align="center" style="background:#f0fdf4;font-weight:bold;color:#15803d;">${formatNumber(r.rasxod)}</td>
                            <td align="center" style="background:#ffffff;">${formatNumber(r.vazvirat)}</td>
                            <td align="center" style="background:#f0f9ff;font-weight:bold;color:#1d4ed8;">${formatNumber(r.pul)}</td>
                            <td align="center" style="background:#ffffff;">${formatNumber(r.kilik_ozi)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background:#f8fafc;font-weight:bold;height:45px;font-size:12px;">
                        <td align="center">${filteredRows.length}</td>
                        <td colspan="2" style="padding-left:10px;">JAMI:</td>
                        <td align="center" style="color:#b91c1c;">${formatNumber(totalT)}</td>
                        <td align="center">${formatNumber(totalO)}</td>
                        <td align="center" style="color:#15803d;">${formatNumber(totalR)}</td>
                        <td align="center">${formatNumber(totalV)}</td>
                        <td align="center" style="color:#1d4ed8;">${formatNumber(totalP)}</td>
                        <td align="center">${formatNumber(totalK)}</td>
                    </tr>
                    <tr style="background:#eff6ff;color:#1e40af;font-weight:900;height:55px;font-size:16px;">
                        <td colspan="8" align="right" style="padding-right:25px;border-top:2px solid #3b82f6;">JAMI HAQQI (ITOG):</td>
                        <td align="center" style="background:#dbeafe;color:#1e40af;border:2px solid #3b82f6;">${formatNumber(totalI)}</td>
                    </tr>
                </tfoot>
            </table>
        `
        const blob = new Blob([`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Achot</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${tableHtml}</body></html>`], { type: 'application/vnd.ms-excel' })
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${reportName}.xls`; a.click(); URL.revokeObjectURL(url)
        addToast('Excel Tayyor', 'success')
    }

    const totalTovar = useMemo(() => rows.reduce((acc, r) => acc + (Number(r.tovar) || 0), 0), [rows])
    const totalOk = useMemo(() => rows.reduce((acc, r) => acc + (Number(r.ok) || 0), 0), [rows])
    const totalRasxod = useMemo(() => rows.reduce((acc, r) => acc + (Number(r.rasxod) || 0), 0), [rows])
    const totalVazvirat = useMemo(() => rows.reduce((acc, r) => acc + (Number(r.vazvirat) || 0), 0), [rows])
    const totalPul = useMemo(() => rows.reduce((acc, r) => acc + (Number(r.pul) || 0), 0), [rows])
    const totalKilik = useMemo(() => rows.reduce((acc, r) => acc + (Number(r.kilik_ozi) || 0), 0), [rows])
    const totalItog = useMemo(() => rows.reduce((acc, r) => acc + calculateItog(r), 0), [rows])

    const handleSelectionStart = (e: React.MouseEvent) => {
        if (e.button !== 0) return
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.closest('button')) return
        const rect = tableBodyRef.current?.getBoundingClientRect()
        if (!rect) return

        setIsSelecting(true)
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        setSelectionRect({ x1: x, y1: y, x2: x, y2: y })

        const initial = (e.metaKey || e.ctrlKey) ? new Set(selectedRows) : new Set<number>()
        setInitialSelectedRows(initial)
        setSelectedRows(initial)
    }

    // Move selection logic to global listeners for persistence
    useEffect(() => {
        const handleGlobalMove = (e: MouseEvent) => {
            if (!isSelecting || !selectionRect || !tableBodyRef.current) return
            const rect = tableBodyRef.current.getBoundingClientRect()
            const containerRect = tableContainerRef.current?.getBoundingClientRect()
            if (!rect || !containerRect) return

            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            setSelectionRectByPoints(selectionRect.x1, selectionRect.y1, x, y)

            // AUTO-SCROLL LOGIC
            if (scrollInterval.current) clearInterval(scrollInterval.current)
            const scrollThreshold = 50
            const scrollSpeed = 15

            if (e.clientY > containerRect.bottom - scrollThreshold) {
                scrollInterval.current = setInterval(() => { if (tableContainerRef.current) tableContainerRef.current.scrollTop += scrollSpeed }, 20)
            } else if (e.clientY < containerRect.top + scrollThreshold) {
                scrollInterval.current = setInterval(() => { if (tableContainerRef.current) tableContainerRef.current.scrollTop -= scrollSpeed }, 20)
            }
        }

        const handleGlobalUp = () => {
            setIsSelecting(false)
            if (scrollInterval.current) { clearInterval(scrollInterval.current); scrollInterval.current = null; }
        }

        if (isSelecting) {
            window.addEventListener('mousemove', handleGlobalMove)
            window.addEventListener('mouseup', handleGlobalUp)
        }
        return () => {
            window.removeEventListener('mousemove', handleGlobalMove)
            window.removeEventListener('mouseup', handleGlobalUp)
        }
    }, [isSelecting, selectionRect, initialSelectedRows])

    const setSelectionRectByPoints = (x1: number, y1: number, x2: number, y2: number) => {
        setSelectionRect(prev => prev ? { ...prev, x2, y2 } : null)

        const xMin = Math.min(x1, x2)
        const xMax = Math.max(x1, x2)
        const yMin = Math.min(y1, y2)
        const yMax = Math.max(y1, y2)

        const newSelected = new Set(initialSelectedRows)
        const trs = tableBodyRef.current?.querySelectorAll('tr')
        trs?.forEach((tr, idx) => {
            const trRect = {
                top: (tr as any).offsetTop,
                bottom: (tr as any).offsetTop + (tr as any).offsetHeight,
                left: (tr as any).offsetLeft,
                right: (tr as any).offsetLeft + (tr as any).offsetWidth
            }
            if (!(xMin > trRect.right || xMax < trRect.left || yMin > trRect.bottom || yMax < trRect.top)) {
                newSelected.add(idx)
            }
        })
        setSelectedRows(newSelected)
    }

    const handleDeleteSelected = () => {
        if (selectedRows.size === 0) return
        if (confirm(`${selectedRows.size} ta qatorni o'chirishni tasdiqlaysizmi?`)) {
            setRows(prev => prev.filter((_, i) => !selectedRows.has(i)))
            setSelectedRows(new Set())
            addToast('O\'chirildi', 'success')
        }
    }

    return (
        <div className={`dashboard-layout ${theme}`}>
            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className={`toast toast-${t.type}`}>
                        {t.type === 'success' && <CheckCircle2 size={20} color="#10b981" />}
                        {t.type === 'error' && <AlertCircle size={20} color="#ef4444" />}
                        {t.type === 'info' && <Info size={20} color="var(--primary)" />}
                        <span>{t.text}</span>
                    </div>
                ))}
            </div>

            <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="logo-svg">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                        <div className="logo-text">ACHOT CRM</div>
                    </div>
                    <div className={`online-status ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Internet bor' : 'Internet yo\'q'}></div>
                    <button className="icon-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                        {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>
                <nav className="nav-actions">
                    <button onClick={handleNewReport} className="nav-btn active">
                        <FilePlus size={20} /> <span className="btn-label">Yangi Achot</span>
                    </button>
                    <button onClick={() => { fetchReportGroups(); setIsLoadModalOpen(true); }} className="nav-btn">
                        <FolderOpen size={20} /> <span className="btn-label">Saqlanganlar</span>
                    </button>
                    <button onClick={() => setIsSaveModalOpen(true)} className="nav-btn">
                        <Save size={20} /> <span className="btn-label">Saqlash</span>
                    </button>
                    <button onClick={exportPDF} className="nav-btn">
                        <Download size={20} /> <span className="btn-label">PDF Export</span>
                    </button>
                    <button onClick={exportExcel} className="nav-btn">
                        <FileSpreadsheet size={20} /> <span className="btn-label">Excel Export</span>
                    </button>
                </nav>
                <div className="sidebar-footer" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button onClick={toggleTheme} className="nav-btn theme-toggle-btn">
                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                        <span className="btn-label">{theme === 'light' ? 'Tungi Rejim' : 'Kungi Rejim'}</span>
                    </button>
                    <button onClick={() => {
                        if (hasUnsavedChanges) {
                            setPendingAction(() => () => signOut())
                            setIsUnsavedModalOpen(true)
                            return
                        }
                        signOut()
                    }} className="nav-btn" style={{ color: '#ef4444' }}>
                        <LogOut size={20} /> <span className="btn-label">Chiqish</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <header className="content-header">
                    <div className="title-group">
                        <h2>{activeGroupId ? reportName : 'Yangi Hisobot'}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{reportDate} • {user?.email}</p>
                            <div style={{
                                background: 'var(--primary)',
                                color: 'white',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '20px',
                                fontSize: '0.9rem',
                                fontWeight: 800,
                                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                            }}>
                                JAMI: {formatNumber(totalItog)}
                            </div>
                        </div>
                    </div>
                    <div className="bulk-add-controls">
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)' }}>Qator qo'shish:</span>
                        <input type="number" className="bulk-add-input" value={numRowsToAdd} onChange={e => setNumRowsToAdd(Math.max(1, parseInt(e.target.value) || 1))} />
                        <button className="bulk-add-btn" onClick={handleBulkAddRows}><Plus size={16} /> Qo'shish</button>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {selectedRows.size > 0 && (
                            <button className="icon-btn" style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius)', fontWeight: 700 }} onClick={handleDeleteSelected}>
                                <Trash2 size={18} style={{ marginRight: '0.5rem' }} /> O'chirish ({selectedRows.size})
                            </button>
                        )}
                    </div>
                </header>

                <div className="table-container" ref={tableContainerRef}>
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>
                                    <div className="custom-checkbox" onClick={() => {
                                        if (selectedRows.size === rows.length) setSelectedRows(new Set())
                                        else setSelectedRows(new Set(rows.keys()))
                                    }}>
                                        {selectedRows.size === rows.length ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </div>
                                </th>
                                <th className="n-col">N</th>
                                <th style={{ textAlign: 'left', minWidth: '200px' }}>SABABLAR</th>
                                <th>TOVAR</th>
                                <th>OK</th>
                                <th>RASXOD</th>
                                <th>VAZVIRAT</th>
                                <th>PUL</th>
                                <th>KILIK O'ZI</th>
                            </tr>
                        </thead>
                        <tbody
                            ref={tableBodyRef}
                            onMouseDown={handleSelectionStart}
                            style={{ position: 'relative' }}
                        >
                            {isSelecting && selectionRect && (
                                <div className="selection-marquee" style={{
                                    left: Math.min(selectionRect.x1, selectionRect.x2),
                                    top: Math.min(selectionRect.y1, selectionRect.y2),
                                    width: Math.abs(selectionRect.x2 - selectionRect.x1),
                                    height: Math.abs(selectionRect.y2 - selectionRect.y1)
                                }} />
                            )}
                            {rows.map((row, index) => (
                                <TableRow
                                    key={index}
                                    index={index}
                                    row={row}
                                    isSelected={selectedRows.has(index)}
                                    onToggleSelect={(idx: number) => {
                                        setSelectedRows(prev => {
                                            const next = new Set(prev)
                                            if (next.has(idx)) next.delete(idx)
                                            else next.add(idx)
                                            return next
                                        })
                                    }}
                                    onInputChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    formatNumber={formatNumber}
                                    inputRefs={inputRefs}
                                />
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="jami-row">
                                <td colSpan={2}>{rows.length}</td>
                                <td>JAMI</td>
                                <td>{formatNumber(totalTovar)}</td>
                                <td>{formatNumber(totalOk)}</td>
                                <td>{formatNumber(totalRasxod)}</td>
                                <td>{formatNumber(totalVazvirat)}</td>
                                <td>{formatNumber(totalPul)}</td>
                                <td>{formatNumber(totalKilik)}</td>
                                <td style={{ borderTop: '2px solid var(--primary)' }}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </main>

            {isSaveModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Hisobotni Saqlash</h3>
                            <button className="icon-btn" onClick={() => setIsSaveModalOpen(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="input-group">
                                <label>Hisobot Nomi</label>
                                <input type="text" value={reportName} onChange={e => setReportName(e.target.value)} autoFocus />
                            </div>
                            <div className="input-group">
                                <label>Sana</label>
                                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setIsSaveModalOpen(false)} className="btn-secondary">Bekor Qilish</button>
                            <button onClick={handleFinalSave} className="btn-primary">Saqlash</button>
                        </div>
                    </div>
                </div>
            )}

            {isLoadModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Saqlangan Hisobotlar</h3>
                            <button className="icon-btn" onClick={() => setIsLoadModalOpen(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="search-box" style={{ marginBottom: '1rem', position: 'relative' }}>
                                <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                                <input type="text" placeholder="Qidirish..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: '2.5rem', width: '100%', height: '44px', border: '1px solid var(--border)', borderRadius: '10px' }} />
                            </div>
                            <div className="report-list">
                                {reportGroups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase())).map(group => (
                                    <div key={group.id} className="report-item" onClick={() => loadReport(group)}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{group.name}</div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{group.report_date}</div>
                                        </div>
                                        <button className="icon-btn" style={{ color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); if (confirm('O\'chirilsinmi?')) supabase.from('report_groups').delete().eq('id', group.id).then(() => fetchReportGroups()) }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isUnsavedModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content unsaved-modal">
                        <div className="modal-header">
                            <h3>Saqlanmagan ma'lumotlar!</h3>
                            <button className="icon-btn" onClick={() => setIsUnsavedModalOpen(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                            <div className="warning-icon" style={{ color: '#f59e0b', marginBottom: '1rem' }}>
                                <AlertCircle size={48} />
                            </div>
                            <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>O'zgarishlar saqlanmadi!</p>
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Chiqishdan oldin ma'lumotlarni saqlashni xohlaysizmi?</p>
                        </div>
                        <div className="modal-footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <button onClick={async () => {
                                await handleFinalSave()
                                setIsUnsavedModalOpen(false)
                                if (pendingAction) { pendingAction(); setPendingAction(null) }
                            }} className="btn-primary" style={{ gridColumn: 'span 2' }}>Saqlash va Davom Etish</button>
                            <button onClick={() => {
                                setHasUnsavedChanges(false)
                                setIsUnsavedModalOpen(false)
                                if (pendingAction) { pendingAction(); setPendingAction(null) }
                            }} className="btn-secondary" style={{ color: '#ef4444' }}>Saqlamasdan Chiqish</button>
                            <button onClick={() => { setIsUnsavedModalOpen(false); setPendingAction(null); }} className="btn-secondary">Bekor Qilish</button>
                        </div>
                    </div>
                </div>
            )}
            {loading && (
                <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(2px)' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '1rem 2rem', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: 'var(--shadow)' }}>
                        <div style={{ animation: 'spin 1s linear infinite' }}>
                            <Search size={24} style={{ color: 'var(--primary)' }} />
                        </div>
                        <span style={{ fontWeight: 700 }}>Yuklanmoqda...</span>
                    </div>
                </div>
            )}
        </div>
    )
}

const TableRow = memo(({ index, row, isSelected, onToggleSelect, onInputChange, onKeyDown, formatNumber, inputRefs }: any) => {
    return (
        <tr className={isSelected ? 'row-selected' : ''}>
            <td style={{ width: '40px' }}>
                <div className="custom-checkbox" onClick={() => onToggleSelect(index)}>
                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                </div>
            </td>
            <td className="n-col">{index + 1}</td>
            <td className="sabablar-col sabablar-cell">
                <input ref={el => inputRefs.current[`${index}-sabablar`] = el} value={row.sabablar} onChange={e => onInputChange(index, 'sabablar', e.target.value)} onKeyDown={e => onKeyDown(e, index, 'sabablar')} />
            </td>
            <td className="tovar-cell">
                <input ref={el => inputRefs.current[`${index}-tovar`] = el} value={formatNumber(row.tovar)} onChange={e => onInputChange(index, 'tovar', e.target.value)} onKeyDown={e => onKeyDown(e, index, 'tovar')} />
            </td>
            <td className="ok-cell">
                <input ref={el => inputRefs.current[`${index}-ok`] = el} value={formatNumber(row.ok)} onChange={e => onInputChange(index, 'ok', e.target.value)} onKeyDown={e => onKeyDown(e, index, 'ok')} />
            </td>
            <td className="rasxod-cell">
                <input ref={el => inputRefs.current[`${index}-rasxod`] = el} value={formatNumber(row.rasxod)} onChange={e => onInputChange(index, 'rasxod', e.target.value)} onKeyDown={e => onKeyDown(e, index, 'rasxod')} />
            </td>
            <td className="vazvirat-cell">
                <input ref={el => inputRefs.current[`${index}-vazvirat`] = el} value={formatNumber(row.vazvirat)} onChange={e => onInputChange(index, 'vazvirat', e.target.value)} onKeyDown={e => onKeyDown(e, index, 'vazvirat')} />
            </td>
            <td className="pul-cell">
                <input ref={el => inputRefs.current[`${index}-pul`] = el} value={formatNumber(row.pul)} onChange={e => onInputChange(index, 'pul', e.target.value)} onKeyDown={e => onKeyDown(e, index, 'pul')} />
            </td>
            <td className="kilik-cell">
                <input ref={el => inputRefs.current[`${index}-kilik_ozi`] = el} value={formatNumber(row.kilik_ozi)} onChange={e => onInputChange(index, 'kilik_ozi', e.target.value)} onKeyDown={e => onKeyDown(e, index, 'kilik_ozi')} />
            </td>
        </tr>
    )
})

export default Dashboard

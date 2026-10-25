import Component from 'vue-class-component'
import BaseMixin from '@/components/mixins/base'

export type ToolAxis = 'x' | 'y' | 'z'

export interface ToolOffsets {
    x: number
    y: number
    z: number
}

export interface PrinterTool {
    name: string
    tool_number: number
    active: boolean
    extruder: string
    gcode_x_offset: number
    gcode_y_offset: number
    gcode_z_offset: number
}

export interface OffsetRow {
    axis: ToolAxis
    saved: string
    current: string
    delta: string
    deltaClass: string
    changed: boolean
}

export const TOOL_AXES: ToolAxis[] = ['x', 'y', 'z']

const ARM_TIMEOUT_MS = 4000
const DELTA_BIG_THRESHOLD_MM = 0.1
const TOOL_NAME_PATTERN = /^tool T\d+$/
const OFFSET_KEYS: Record<ToolAxis, keyof PrinterTool> = {
    x: 'gcode_x_offset',
    y: 'gcode_y_offset',
    z: 'gcode_z_offset',
}
const TOOL_COLORS = ['#b6e63a', '#ff5252', '#b66cff', '#2fd0e6', '#3ddc84', '#6c7bff', '#ffb020', '#ff7ab6']

@Component
export default class ToolchangerMixin extends BaseMixin {
    axes: ToolAxis[] = TOOL_AXES
    armedKey: string | null = null
    armTimer: number | null = null
    // running offsets recorded just before a calibration; null until one has run this session
    baseOffsets: Record<number, ToolOffsets> | null = null

    get tools(): PrinterTool[] {
        return Object.keys(this.$store.state.printer)
            .filter((name) => TOOL_NAME_PATTERN.test(name))
            .map((name) => this.$store.state.printer[name] as PrinterTool)
            .filter((tool) => tool?.tool_number != null)
            .sort((a, b) => a.tool_number - b.tool_number)
    }

    get toolNumbers(): number[] {
        return this.tools.map((tool) => tool.tool_number)
    }

    get hasToolchanger(): boolean {
        return this.tools.length > 0
    }

    get mountedTool(): number | null {
        const mounted: number = this.$store.state.printer.toolchanger?.tool_number ?? -1
        if (mounted >= 0) return mounted

        return this.tools.find((tool) => tool.active)?.tool_number ?? null
    }

    get mountedLabel(): string {
        if (this.mountedTool === null) return String(this.$t('Panels.Toolchanger.NoTool'))

        return String(this.$t('Panels.Toolchanger.MountedTool', { tool: `T${this.mountedTool}` }))
    }

    get isHomed(): boolean {
        return String(this.$store.state.printer.toolhead?.homed_axes ?? '').includes('xyz')
    }

    get homedLabel(): string {
        return String(this.$t(this.isHomed ? 'Panels.Toolchanger.Homed' : 'Panels.Toolchanger.NotHomed'))
    }

    get stateLabel(): string {
        return String(this.$t(this.printerIsPrinting ? 'Panels.Toolchanger.Printing' : 'Panels.Toolchanger.Idle'))
    }

    get savedSourceLabel(): string {
        const key = this.baseOffsets ? 'Panels.Toolchanger.BeforeLastRun' : 'Panels.Toolchanger.SavedConfig'

        return String(this.$t(key))
    }

    get savePending(): boolean {
        return !!this.$store.state.printer.configfile?.save_config_pending
    }

    get hasEddyCalibrate(): boolean {
        return 'ktc_eddy_calibrate' in this.$store.state.printer
    }

    get isCalibrating(): boolean {
        const operation: string | undefined = this.$store.state.printer.ktc_eddy_calibrate?.operation
        return !!operation && operation !== 'idle'
    }

    get canCheck(): boolean {
        return this.hasEddyCalibrate && !this.isCalibrating
    }

    get canCalibrate(): boolean {
        return this.canCheck && this.isHomed && !this.printerIsPrinting
    }

    get calibrationPercent(): number {
        return Math.round((this.$store.state.printer.ktc_eddy_calibrate?.progress ?? 0) * 100)
    }

    get calibrationLabel(): string {
        const calibration = this.$store.state.printer.ktc_eddy_calibrate ?? {}
        const tool = calibration.current_tool >= 0 ? `T${calibration.current_tool} · ` : ''

        return tool + (calibration.current_step ?? '')
    }

    isMounted(tool: PrinterTool): boolean {
        return this.mountedTool === tool.tool_number
    }

    toolColor(toolNumber: number): string {
        return TOOL_COLORS[toolNumber % TOOL_COLORS.length]
    }

    temperatureLabel(tool: PrinterTool): string {
        const extruder = this.$store.state.printer[tool.extruder] ?? {}
        if (extruder.temperature == null) return '-'

        const target = extruder.target ? ` / ${Math.round(extruder.target)}°` : ''

        return `${Number(extruder.temperature).toFixed(1)}°${target}`
    }

    // before the first calibration this session: config as loaded at Klipper start
    // after a calibration has been started: running offsets recorded just before it
    savedOffset(toolNumber: number, axis: ToolAxis): number {
        const base = this.baseOffsets?.[toolNumber]
        if (base) return base[axis]

        const settings = this.$store.state.printer.configfile?.settings?.[`tool t${toolNumber}`] ?? {}

        return Number(settings[`gcode_${axis}_offset`] ?? 0)
    }

    snapshotBaseOffsets(): void {
        const snapshot: Record<number, ToolOffsets> = {}
        this.tools.forEach((tool) => {
            const values = { x: 0, y: 0, z: 0 }
            TOOL_AXES.forEach((axis) => {
                values[axis] = this.currentOffset(tool, axis)
            })
            snapshot[tool.tool_number] = values
        })
        this.baseOffsets = snapshot
    }

    currentOffset(tool: PrinterTool, axis: ToolAxis): number {
        return tool[OFFSET_KEYS[axis]] as number
    }

    pendingOffset(toolNumber: number, axis: ToolAxis): number | null {
        const items = this.$store.state.printer.configfile?.save_config_pending_items ?? {}

        return items[`tool T${toolNumber}`]?.[`gcode_${axis}_offset`] ?? null
    }

    offsetRows(tool: PrinterTool): OffsetRow[] {
        return TOOL_AXES.map((axis) => {
            const saved = this.savedOffset(tool.tool_number, axis)
            const current = this.currentOffset(tool, axis)
            const delta = Math.round((current - saved) * 1000) / 1000

            return {
                axis,
                saved: this.formatOffset(saved),
                current: this.formatOffset(current),
                delta: this.formatOffset(delta, true),
                deltaClass: this.deltaClass(delta),
                changed: delta !== 0,
            }
        })
    }

    formatOffset(value: number, signed = false): string {
        return (signed && value > 0 ? '+' : '') + value.toFixed(3)
    }

    deltaClass(delta: number): string {
        if (delta === 0) return 'text--secondary'

        return Math.abs(delta) >= DELTA_BIG_THRESHOLD_MM
            ? 'error--text font-weight-bold'
            : 'warning--text font-weight-bold'
    }

    sendGcode(script: string): void {
        this.$socket.emit('printer.gcode.script', { script })
    }

    armLabel(key: string, labelKey: string): string {
        const translationKey = this.armedKey === key ? 'Panels.Toolchanger.TapToConfirm' : labelKey

        return String(this.$t(translationKey))
    }

    // first tap arms the button, second tap within ARM_TIMEOUT_MS runs the command
    armOrRun(key: string, script: string): void {
        if (this.armedKey !== key) {
            this.arm(key)
            return
        }

        this.disarm()
        this.sendGcode(script)
    }

    arm(key: string): void {
        this.disarm()
        this.armedKey = key
        this.armTimer = window.setTimeout(() => this.disarm(), ARM_TIMEOUT_MS)
    }

    disarm(): void {
        if (this.armTimer !== null) window.clearTimeout(this.armTimer)
        this.armTimer = null
        this.armedKey = null
    }

    beforeDestroy(): void {
        this.disarm()
    }
}
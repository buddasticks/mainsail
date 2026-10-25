<template>
    <panel
        v-if="hasToolchanger"
        :icon="mdiWrench"
        :title="$t('Panels.ToolOffsetsPanel.Headline')"
        :collapsible="true"
        card-class="tool-offsets-panel">
        <div class="pa-3">
            <div class="d-flex flex-wrap align-center mb-3">
                <v-chip small outlined :color="mountedTool !== null ? 'primary' : ''" class="mr-2 mb-1">
                    {{ mountedLabel }}
                </v-chip>
                <v-chip small outlined class="mr-2 mb-1">{{ homedLabel }}</v-chip>
                <v-chip small outlined class="mb-1">{{ stateLabel }}</v-chip>
            </div>

            <v-row dense>
                <v-col v-for="tool in tools" :key="tool.name" cols="12" sm="6">
                    <v-card outlined class="pa-2 fill-height">
                        <div class="d-flex align-center mb-1">
                            <span class="font-weight-bold" :style="{ color: toolColor(tool.tool_number) }">
                                T{{ tool.tool_number }}
                            </span>
                            <v-chip v-if="isMounted(tool)" x-small color="success" class="ml-2">
                                {{ $t('Panels.Toolchanger.Mounted') }}
                            </v-chip>
                            <span class="ml-auto text-caption">{{ temperatureLabel(tool) }}</span>
                        </div>
                        <v-simple-table dense class="offset-table">
                            <thead>
                                <tr>
                                    <th class="px-1"></th>
                                    <th class="text-right px-1">{{ $t('Panels.Toolchanger.Saved') }}</th>
                                    <th class="text-right px-1">{{ $t('Panels.Toolchanger.New') }}</th>
                                    <th class="text-right px-1">{{ $t('Panels.Toolchanger.Delta') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="row in offsetRows(tool)" :key="row.axis">
                                    <td class="font-weight-bold text-uppercase px-1">{{ row.axis }}</td>
                                    <td class="text-right text--secondary px-1">{{ row.saved }}</td>
                                    <td class="text-right px-1" :class="row.changed ? 'warning--text font-weight-bold' : ''">
                                        {{ row.current }}
                                    </td>
                                    <td class="text-right px-1" :class="row.deltaClass">{{ row.delta }}</td>
                                </tr>
                            </tbody>
                        </v-simple-table>
                    </v-card>
                </v-col>
            </v-row>

            <div class="caption text--secondary mt-2">{{ $t('Panels.ToolOffsetsPanel.Hint') }}</div>
            <div class="caption text--secondary">
                {{ $t('Panels.ToolOffsetsPanel.SavedColumn') }} {{ savedSourceLabel }}
            </div>

            <v-divider class="my-3" />

            <div class="text-subtitle-2">{{ $t('Panels.ToolOffsetsPanel.Calibrate') }}</div>
            <div class="caption text--secondary mb-2">{{ $t('Panels.ToolOffsetsPanel.CalibrateHint') }}</div>

            <div class="d-flex flex-wrap mb-2">
                <v-chip
                    v-for="num in toolNumbers"
                    :key="'select-' + num"
                    small
                    class="mr-1 mb-1"
                    :outlined="!isSelected(num)"
                    :color="isSelected(num) ? 'primary' : ''"
                    @click="toggleTool(num)">
                    T{{ num }}
                </v-chip>
            </div>

            <div class="d-flex flex-wrap">
                <v-btn small outlined class="mr-2 mb-2" :disabled="!canCheck" @click="check">
                    {{ $t('Panels.ToolOffsetsPanel.Check') }}
                </v-btn>
                <v-btn small outlined color="warning" class="mr-2 mb-2" :disabled="!canCalibrate" @click="calibrate('z')">
                    {{ armLabel('z', 'Panels.ToolOffsetsPanel.CalibrateZ') }}
                </v-btn>
                <v-btn small outlined color="warning" class="mr-2 mb-2" :disabled="!canCalibrate" @click="calibrate('xy')">
                    {{ armLabel('xy', 'Panels.ToolOffsetsPanel.CalibrateXY') }}
                </v-btn>
                <v-btn small outlined color="warning" class="mr-2 mb-2" :disabled="!canCalibrate" @click="calibrate('all')">
                    {{ armLabel('all', 'Panels.ToolOffsetsPanel.CalibrateAll') }}
                </v-btn>
            </div>

            <div v-if="isCalibrating" class="mt-2">
                <div class="caption mb-1">{{ calibrationLabel }}</div>
                <v-progress-linear :value="calibrationPercent" height="8" striped rounded />
            </div>

            <v-alert v-if="savePending" dense text type="warning" class="mt-3 mb-0">
                <div class="mb-2">{{ $t('Panels.Toolchanger.SaveConfigPending') }}</div>
                <v-btn small outlined color="success" :disabled="printerIsPrinting" @click="saveConfig">
                    {{ armLabel('save', 'Panels.Toolchanger.SaveConfig') }}
                </v-btn>
            </v-alert>

            <v-divider class="my-3" />

            <div class="text-subtitle-2">{{ $t('Panels.ToolOffsetsPanel.EddySeek') }}</div>
            <div class="caption text--secondary mb-2">{{ $t('Panels.ToolOffsetsPanel.SeekHint') }}</div>

            <div v-if="seekError" class="caption error--text">{{ seekError }}</div>
            <div v-else-if="seekGroups.length === 0" class="caption text--secondary">
                {{ $t('Panels.ToolOffsetsPanel.SeekNotFound') }}
            </div>

            <div v-for="group in seekGroups" :key="group.key" class="mb-1">
                <div class="caption text-uppercase text--secondary mt-2">
                    {{ $t(`Panels.ToolOffsetsPanel.${group.key}`) }}
                </div>
                <div class="d-flex flex-wrap">
                    <v-btn
                        v-for="name in group.names"
                        :key="name"
                        small
                        outlined
                        class="mr-2 mb-2"
                        :color="seekSelected === name ? 'warning' : undefined"
                        :disabled="!canSelectSeek"
                        :title="name"
                        @click="selectSeek(name)">
                        {{ seekLabel(name) }}
                    </v-btn>
                </div>
            </div>

            <v-card v-if="seekSelected" outlined class="pa-2 mt-2">
                <div class="font-weight-bold text-uppercase">{{ seekSelected }}</div>
                <div class="caption text--secondary mb-2">{{ seekHelp[seekSelected] }}</div>
                <div class="d-flex align-center">
                    <v-text-field
                        v-model="seekParamValue"
                        dense
                        outlined
                        hide-details
                        spellcheck="false"
                        class="mr-2" />
                    <v-btn small outlined color="warning" :disabled="!canRunSeek" @click="runSeek">
                        {{ armLabel('seek', 'Panels.ToolOffsetsPanel.Run') }}
                    </v-btn>
                </div>
            </v-card>
        </div>
    </panel>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import ToolchangerMixin from '@/components/mixins/toolchanger'
import Panel from '@/components/ui/Panel.vue'
import { mdiWrench } from '@mdi/js'

type CalibrateMode = 'z' | 'xy' | 'all'

interface SeekGroup {
    key: string
    names: string[]
}

const CALIBRATE_COMMANDS: Record<CalibrateMode, string> = {
    z: 'KTC_EDDY_CALIBRATE_Z',
    xy: 'KTC_EDDY_CALIBRATE_XY',
    all: 'KTC_EDDY_CALIBRATE_ALL',
}

const SEEK_PATTERN = /^(EDDY_SEEK|KTC_EDDY_GOTO_COIL|KTC_EDDY_SET_COIL)/i
const SEEK_GROUPS: SeekGroup[] = [
    { key: 'SeekGroupRead', names: ['EDDY_SEEK_QUERY', 'EDDY_SEEK_STATUS', 'EDDY_SEEK_ACCURACY'] },
    {
        key: 'SeekGroupSetup',
        names: ['EDDY_SEEK_START', 'EDDY_SEEK_SET', 'EDDY_SEEK_TOOL', 'EDDY_SEEK_APPLY_OFFSET', 'EDDY_SEEK_RESET'],
    },
    { key: 'SeekGroupCoil', names: ['KTC_EDDY_GOTO_COIL', 'KTC_EDDY_SET_COIL'] },
]
const SEEK_DEFAULT_PARAMS: Record<string, string> = {
    EDDY_SEEK_START: 'FIND=1',
    KTC_EDDY_SET_COIL: 'USE_CURRENT=1',
}

@Component({
    components: { Panel },
})
export default class ToolOffsetsPanel extends Mixins(ToolchangerMixin) {
    mdiWrench = mdiWrench

    selectedTools: number[] = []
    seekHelp: Record<string, string> = {}
    seekError = ''
    seekSelected: string | null = null
    seekParams: Record<string, string> = {}

    get toolArgs(): string {
        if (this.selectedTools.length === 0) return ''

        const numbers = [...this.selectedTools].sort((a, b) => a - b)

        return ` TOOLS=${numbers.join(',')}`
    }

    get seekGroups(): SeekGroup[] {
        const available = Object.keys(this.seekHelp)
        const groups: SeekGroup[] = []
        const used: string[] = []

        SEEK_GROUPS.forEach((group) => {
            used.push(...group.names)
            const names = group.names.filter((name) => available.includes(name))
            if (names.length) groups.push({ key: group.key, names })
        })

        const rest = available.filter((name) => !used.includes(name)).sort()
        if (rest.length) groups.push({ key: 'SeekGroupOther', names: rest })

        return groups
    }

    get seekParamValue(): string {
        if (this.seekSelected === null) return ''

        return this.seekParams[this.seekSelected] ?? SEEK_DEFAULT_PARAMS[this.seekSelected] ?? ''
    }

    set seekParamValue(value: string) {
        if (this.seekSelected === null) return

        this.seekParams = { ...this.seekParams, [this.seekSelected]: value }
    }

    // selecting a command is safe to do without homing, but not while a print or calibration is running
    get canSelectSeek(): boolean {
        return this.klipperReadyForGui && !this.printerIsPrinting && !this.isCalibrating
    }

    get canRunSeek(): boolean {
        return this.canSelectSeek && this.isHomed
    }

    @Watch('klipperReadyForGui')
    onReadyChanged(ready: boolean): void {
        if (ready) this.loadSeekCommands()
    }

    mounted(): void {
        this.loadSeekCommands()
    }

    isSelected(toolNumber: number): boolean {
        return this.selectedTools.includes(toolNumber)
    }

    toggleTool(toolNumber: number): void {
        if (this.isSelected(toolNumber)) {
            this.selectedTools = this.selectedTools.filter((num) => num !== toolNumber)
            return
        }

        this.selectedTools = [...this.selectedTools, toolNumber]
    }

    check(): void {
        this.sendGcode(`KTC_EDDY_CHECK${this.toolArgs}`)
    }

    calibrate(mode: CalibrateMode): void {
        // only the run tap starts a calibration, so only that tap records the before-last-run offsets
        if (this.armedKey === mode) this.snapshotBaseOffsets()

        this.armOrRun(mode, `${CALIBRATE_COMMANDS[mode]}${this.toolArgs}`)
    }

    saveConfig(): void {
        this.armOrRun('save', 'SAVE_CONFIG')
    }

    async loadSeekCommands(): Promise<void> {
        if (!this.klipperReadyForGui) return

        try {
            const help = (await this.$socket.emitAndWait('printer.gcode.help')) as Record<string, string>
            const seek: Record<string, string> = {}
            Object.keys(help).forEach((name) => {
                if (SEEK_PATTERN.test(name)) seek[name] = help[name]
            })
            this.seekHelp = seek
            this.seekError = ''
        } catch {
            this.seekError = String(this.$t('Panels.ToolOffsetsPanel.SeekLoadError'))
        }
    }

    seekLabel(name: string): string {
        const words = name.replace(/^(EDDY_SEEK_|KTC_EDDY_)/i, '').replace(/_/g, ' ').toLowerCase()

        return words.charAt(0).toUpperCase() + words.slice(1)
    }

    selectSeek(name: string): void {
        this.disarm()
        this.seekSelected = this.seekSelected === name ? null : name
    }

    runSeek(): void {
        if (this.seekSelected === null) return

        this.armOrRun('seek', `${this.seekSelected} ${this.seekParamValue}`.trim())
    }
}
</script>
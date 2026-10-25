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
                        <v-simple-table dense>
                            <thead>
                                <tr>
                                    <th></th>
                                    <th class="text-right">{{ $t('Panels.Toolchanger.Saved') }}</th>
                                    <th class="text-right">{{ $t('Panels.Toolchanger.New') }}</th>
                                    <th class="text-right">{{ $t('Panels.Toolchanger.Delta') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="row in offsetRows(tool)" :key="row.axis">
                                    <td class="font-weight-bold text-uppercase">{{ row.axis }}</td>
                                    <td class="text-right text--secondary">{{ row.saved }}</td>
                                    <td class="text-right" :class="row.changed ? 'warning--text font-weight-bold' : ''">
                                        {{ row.current }}
                                    </td>
                                    <td class="text-right" :class="row.deltaClass">{{ row.delta }}</td>
                                </tr>
                            </tbody>
                        </v-simple-table>
                    </v-card>
                </v-col>
            </v-row>

            <div class="caption text--secondary mt-2">{{ $t('Panels.ToolOffsetsPanel.Hint') }}</div>

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
        </div>
    </panel>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import ToolchangerMixin from '@/components/mixins/toolchanger'
import Panel from '@/components/ui/Panel.vue'
import { mdiWrench } from '@mdi/js'

type CalibrateMode = 'z' | 'xy' | 'all'

const CALIBRATE_COMMANDS: Record<CalibrateMode, string> = {
    z: 'KTC_EDDY_CALIBRATE_Z',
    xy: 'KTC_EDDY_CALIBRATE_XY',
    all: 'KTC_EDDY_CALIBRATE_ALL',
}

@Component({
    components: { Panel },
})
export default class ToolOffsetsPanel extends Mixins(ToolchangerMixin) {
    mdiWrench = mdiWrench

    selectedTools: number[] = []

    get toolArgs(): string {
        if (this.selectedTools.length === 0) return ''

        const numbers = [...this.selectedTools].sort((a, b) => a - b)

        return ` TOOLS=${numbers.join(',')}`
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
        this.armOrRun(mode, `${CALIBRATE_COMMANDS[mode]}${this.toolArgs}`)
    }

    saveConfig(): void {
        this.armOrRun('save', 'SAVE_CONFIG')
    }
}
</script>
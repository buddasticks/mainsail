<template>
    <panel
        v-if="hasToolchanger"
        :icon="mdiTune"
        :title="$t('Panels.ToolTrimPanel.Headline')"
        :collapsible="true"
        card-class="tool-trim-panel">
        <div class="pa-3">
            <div class="caption text--secondary mb-2">{{ $t('Panels.ToolTrimPanel.Hint') }}</div>

            <div class="d-flex flex-wrap mb-3">
                <v-chip
                    v-for="num in toolNumbers"
                    :key="'trim-' + num"
                    small
                    class="mr-2 mb-1"
                    :outlined="!isActive(num)"
                    :color="isActive(num) ? 'primary' : ''"
                    @click="selectTool(num)">
                    T{{ num }}
                </v-chip>
            </div>

            <template v-if="activeTool">
                <v-simple-table dense class="mb-3">
                    <thead>
                        <tr>
                            <th></th>
                            <th class="text-right">{{ $t('Panels.Toolchanger.Saved') }}</th>
                            <th class="text-right">{{ $t('Panels.Toolchanger.New') }}</th>
                            <th class="text-right">{{ $t('Panels.Toolchanger.Delta') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in offsetRows(activeTool)" :key="row.axis">
                            <td class="font-weight-bold text-uppercase">{{ row.axis }}</td>
                            <td class="text-right text--secondary">{{ row.saved }}</td>
                            <td class="text-right" :class="row.changed ? 'warning--text font-weight-bold' : ''">
                                {{ row.current }}
                            </td>
                            <td class="text-right" :class="row.deltaClass">{{ row.delta }}</td>
                        </tr>
                    </tbody>
                </v-simple-table>
            </template>

            <div class="d-flex align-center mb-3">
                <span class="text-subtitle-2 mr-3">{{ $t('Panels.ToolTrimPanel.Step') }}</span>
                <v-btn-toggle v-model="stepIndex" mandatory dense>
                    <v-btn v-for="(value, index) in trimSteps" :key="value" small outlined :value="index">
                        {{ value.toFixed(2) }}
                    </v-btn>
                </v-btn-toggle>
            </div>

            <v-row dense>
                <v-col v-for="axis in axes" :key="axis" cols="4">
                    <v-card outlined class="pa-2 text-center">
                        <div class="font-weight-bold mb-1 text-uppercase">{{ axis }}</div>
                        <div class="d-flex">
                            <v-btn small outlined class="flex-grow-1 mr-1" :disabled="!canAdjust" @click="adjust(axis, -1)">
                                −
                            </v-btn>
                            <v-btn small outlined class="flex-grow-1" :disabled="!canAdjust" @click="adjust(axis, 1)">
                                +
                            </v-btn>
                        </div>
                    </v-card>
                </v-col>
            </v-row>

            <div class="caption mt-2">{{ status }}</div>

            <v-divider class="my-3" />

            <div class="text-subtitle-2">{{ $t('Panels.ToolTrimPanel.StageHint') }}</div>
            <v-btn
                small
                outlined
                color="success"
                class="mt-2"
                :disabled="!canAdjust"
                @click="stage">
                {{ armLabel('stage', 'Panels.ToolTrimPanel.Stage') }}
            </v-btn>

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
import ToolchangerMixin, { PrinterTool, ToolAxis } from '@/components/mixins/toolchanger'
import Panel from '@/components/ui/Panel.vue'
import { mdiTune } from '@mdi/js'

const TRIM_STEPS = [0.01, 0.05, 0.1, 0.5]

@Component({
    components: { Panel },
})
export default class ToolTrimPanel extends Mixins(ToolchangerMixin) {
    mdiTune = mdiTune
    trimSteps = TRIM_STEPS

    stepIndex = 0
    selectedToolNumber: number | null = null
    status = ''

    get step(): number {
        return TRIM_STEPS[this.stepIndex]
    }

    // falls back to the mounted tool, then the first tool, when nothing is selected
    get activeToolNumber(): number | null {
        if (this.selectedToolNumber !== null && this.toolNumbers.includes(this.selectedToolNumber)) {
            return this.selectedToolNumber
        }

        return this.mountedTool ?? this.toolNumbers[0] ?? null
    }

    get activeTool(): PrinterTool | null {
        return this.tools.find((tool) => tool.tool_number === this.activeToolNumber) ?? null
    }

    get canAdjust(): boolean {
        return this.klipperReadyForGui && this.activeTool !== null
    }

    isActive(toolNumber: number): boolean {
        return this.activeToolNumber === toolNumber
    }

    selectTool(toolNumber: number): void {
        this.selectedToolNumber = toolNumber
    }

    adjust(axis: ToolAxis, direction: 1 | -1): void {
        const toolNumber = this.activeToolNumber
        if (toolNumber === null) return

        const delta = direction * this.step
        const value = `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`
        const axisName = axis.toUpperCase()

        this.sendGcode(`KTC_OFFSET_ADJUST T=${toolNumber} ${axisName}=${value}`)
        this.status = `T${toolNumber} ${axisName} ${value} mm`
    }

    stage(): void {
        if (this.activeToolNumber === null) return

        this.armOrRun('stage', `KTC_OFFSET_SAVE T=${this.activeToolNumber}`)
    }

    saveConfig(): void {
        this.armOrRun('save', 'SAVE_CONFIG')
    }
}
</script>
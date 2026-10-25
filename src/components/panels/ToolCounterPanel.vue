<template>
    <panel
        v-if="hasSaveVariables"
        :icon="mdiCounter"
        :title="$t('Panels.ToolCounterPanel.Headline')"
        :collapsible="true"
        card-class="tool-counter-panel">
        <div class="pa-3">
            <div class="d-flex align-center justify-space-between mb-3">
                <div>
                    <div class="text-overline">{{ $t('Panels.ToolCounterPanel.Total') }}</div>
                    <div class="caption text--secondary">{{ $t('Panels.ToolCounterPanel.TotalCaption') }}</div>
                </div>
                <div class="text-h4 primary--text font-weight-bold">{{ totalLabel }}</div>
            </div>

            <div v-if="!hasCounterData" class="caption text--secondary">
                {{ $t('Panels.ToolCounterPanel.NoData') }}
            </div>

            <v-row v-else dense>
                <v-col v-for="row in counterRows" :key="row.number" cols="6" md="3">
                    <v-card outlined class="pa-2">
                        <div class="font-weight-bold mb-1">T{{ row.number }}</div>
                        <div class="d-flex justify-space-between">
                            <span class="caption text--secondary">{{ $t('Panels.ToolCounterPanel.Pickups') }}</span>
                            <span class="font-weight-bold success--text">{{ row.pickups.toLocaleString() }}</span>
                        </div>
                        <div class="d-flex justify-space-between">
                            <span class="caption text--secondary">{{ $t('Panels.ToolCounterPanel.Failures') }}</span>
                            <span :class="failureClass(row.failures)">{{ row.failures.toLocaleString() }}</span>
                        </div>
                    </v-card>
                </v-col>
            </v-row>
        </div>
    </panel>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import ToolchangerMixin from '@/components/mixins/toolchanger'
import Panel from '@/components/ui/Panel.vue'
import { mdiCounter } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class ToolCounterPanel extends Mixins(ToolchangerMixin) {
    mdiCounter = mdiCounter

    get hasSaveVariables(): boolean {
        return 'save_variables' in this.$store.state.printer
    }

    get variables(): Record<string, unknown> {
        return this.$store.state.printer.save_variables?.variables ?? {}
    }

    get hasCounterData(): boolean {
        return 'total_toolchanges' in this.variables
    }

    get totalLabel(): string {
        return this.counterValue('total_toolchanges').toLocaleString()
    }

    get counterRows(): { number: number; pickups: number; failures: number }[] {
        return this.toolNumbers.map((number) => ({
            number,
            pickups: this.counterValue(`tool_t${number}_pickups`),
            failures: this.counterValue(`tool_t${number}_failures`),
        }))
    }

    counterValue(key: string): number {
        const value = Number(this.variables[key])

        return Number.isFinite(value) && value >= 0 ? value : 0
    }

    failureClass(failures: number): string {
        return failures > 0 ? 'error--text font-weight-bold' : 'text--secondary'
    }
}
</script>
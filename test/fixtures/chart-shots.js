import { readFileSync } from 'node:fs';

const LEGACY_SCALE_KEY = 'weight';
const LEGACY_RATE_KEY = 'weightFlow';

export const RECORDED_SHOT_IDS = Object.freeze([
    '5fc3f631-6b18-471b-9800-00d552dbbecb',
    'cd020a51-f353-4ffb-8389-72c931640181',
    'd5139a1f-c4ee-47e2-bb80-0cbf3e39b6a3',
]);

const readRecorded = (name) => JSON.parse(readFileSync(new URL(`../../tools/rea-fixtures/${name}`, import.meta.url), 'utf8'));

export function recordedShot(id) {
    return readRecorded(`api__v1__shots__${id}.json`);
}

export function recordedShotList() {
    return readRecorded('api__v1__shots~limit=20~offset=0~order=desc.json');
}

export function convertedShot(id) {
    const record = structuredClone(recordedShot(id));
    record.measurements = record.measurements.map((row) => {
        const machine = { ...row.machine };
        const grams = machine[LEGACY_SCALE_KEY];
        const rate = machine[LEGACY_RATE_KEY];
        delete machine[LEGACY_SCALE_KEY];
        delete machine[LEGACY_RATE_KEY];
        const scale = typeof grams === 'number'
            ? { timestamp: machine.timestamp, [LEGACY_SCALE_KEY]: grams, [LEGACY_RATE_KEY]: rate ?? 0 }
            : null;
        return { ...row, machine, scale };
    });
    return record;
}

export function withShotFlag(record, flag) {
    return { ...record, de1Emulation: flag };
}

export function withoutTarget(record) {
    const workflow = structuredClone(record.workflow);
    if (workflow.context) delete workflow.context.targetYield;
    if (workflow.profile) delete workflow.profile.target_weight;
    return { ...record, workflow };
}

export function withMachineModel(record, model) {
    const workflow = structuredClone(record.workflow);
    workflow.machine = { ...(workflow.machine ?? {}), model };
    return { ...record, workflow };
}

export function withProfile(record, change) {
    const workflow = structuredClone(record.workflow);
    workflow.profile = change(workflow.profile);
    return { ...record, workflow };
}

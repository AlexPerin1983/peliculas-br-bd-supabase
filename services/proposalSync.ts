import { Measurement, ProposalOption } from '../types';

export interface ProposalOptionsSnapshot {
    options: ProposalOption[];
    revision: number;
}

export interface ProposalOptionsSaveContext {
    baseRevision: number;
    baseOptions: ProposalOption[];
    deviceId: string;
    operations?: ProposalOptionOperation[];
}

export interface ProposalOptionsSaveResult extends ProposalOptionsSnapshot {
    conflictResolved: boolean;
    preservedConflicts: number;
}

export interface ProposalOptionsMergeResult {
    options: ProposalOption[];
    preservedConflicts: number;
}

export type ProposalOptionOperation =
    | {
        type: 'upsert_option';
        optionId: number;
        option: Pick<ProposalOption, 'id' | 'name' | 'generalDiscount'>;
    }
    | {
        type: 'delete_option';
        optionId: number;
    }
    | {
        type: 'upsert_measurement';
        optionId: number;
        measurement: Measurement;
    }
    | {
        type: 'delete_measurement';
        optionId: number;
        measurementId: number;
    }
    | {
        type: 'set_option_order';
        optionIds: number[];
    }
    | {
        type: 'set_measurement_order';
        optionId: number;
        measurementIds: number[];
    };

const comparable = (value: unknown): string => JSON.stringify(value);

const same = (left: unknown, right: unknown): boolean => comparable(left) === comparable(right);

const sameIds = (left: Array<{ id: number }>, right: Array<{ id: number }>): boolean => (
    left.length === right.length
    && left.every((item, index) => item.id === right[index]?.id)
);

const cloneOptions = (options: ProposalOption[]): ProposalOption[] => (
    JSON.parse(JSON.stringify(options)) as ProposalOption[]
);

/**
 * Produz o menor lote necessário para transformar a revisão confirmada no
 * rascunho atual. Nada é emitido para campos que não mudaram.
 */
export const buildProposalOperations = (
    baseOptions: ProposalOption[],
    nextOptions: ProposalOption[]
): ProposalOptionOperation[] => {
    const operations: ProposalOptionOperation[] = [];
    const baseById = new Map(baseOptions.map(option => [option.id, option]));
    const nextById = new Map(nextOptions.map(option => [option.id, option]));

    for (const option of nextOptions) {
        const baseOption = baseById.get(option.id);
        const metadata = {
            id: option.id,
            name: option.name,
            generalDiscount: option.generalDiscount
        };

        if (
            !baseOption
            || !same(
                { name: baseOption.name, generalDiscount: baseOption.generalDiscount },
                { name: option.name, generalDiscount: option.generalDiscount }
            )
        ) {
            operations.push({ type: 'upsert_option', optionId: option.id, option: metadata });
        }

        const baseMeasurements = baseOption?.measurements ?? [];
        const baseMeasurementsById = new Map(baseMeasurements.map(measurement => [measurement.id, measurement]));
        const nextMeasurementsById = new Map(option.measurements.map(measurement => [measurement.id, measurement]));

        for (const measurement of option.measurements) {
            const baseMeasurement = baseMeasurementsById.get(measurement.id);
            if (!baseMeasurement || !same(baseMeasurement, measurement)) {
                operations.push({
                    type: 'upsert_measurement',
                    optionId: option.id,
                    measurement
                });
            }
        }

        for (const measurement of baseMeasurements) {
            if (!nextMeasurementsById.has(measurement.id)) {
                operations.push({
                    type: 'delete_measurement',
                    optionId: option.id,
                    measurementId: measurement.id
                });
            }
        }

        if (!sameIds(baseMeasurements, option.measurements)) {
            operations.push({
                type: 'set_measurement_order',
                optionId: option.id,
                measurementIds: option.measurements.map(measurement => measurement.id)
            });
        }
    }

    for (const option of baseOptions) {
        if (!nextById.has(option.id)) {
            operations.push({ type: 'delete_option', optionId: option.id });
        }
    }

    if (!sameIds(baseOptions, nextOptions)) {
        operations.push({
            type: 'set_option_order',
            optionIds: nextOptions.map(option => option.id)
        });
    }

    return operations;
};

/** Espelho local da função SQL, usado para testes e confirmação da resposta. */
export const applyProposalOperations = (
    snapshot: ProposalOption[],
    operations: ProposalOptionOperation[]
): ProposalOption[] => {
    let result = cloneOptions(snapshot);

    for (const operation of operations) {
        switch (operation.type) {
            case 'upsert_option': {
                const index = result.findIndex(option => option.id === operation.optionId);
                if (index < 0) {
                    result.push({ ...operation.option, measurements: [] });
                } else {
                    result[index] = { ...result[index], ...operation.option };
                }
                break;
            }
            case 'delete_option':
                result = result.filter(option => option.id !== operation.optionId);
                break;
            case 'upsert_measurement': {
                const option = result.find(candidate => candidate.id === operation.optionId);
                if (!option) {
                    throw new Error(`Opção ${operation.optionId} não existe para receber a medida.`);
                }
                const index = option.measurements.findIndex(measurement => measurement.id === operation.measurement.id);
                if (index < 0) {
                    option.measurements.push(operation.measurement);
                } else {
                    option.measurements[index] = operation.measurement;
                }
                break;
            }
            case 'delete_measurement': {
                const option = result.find(candidate => candidate.id === operation.optionId);
                if (option) {
                    option.measurements = option.measurements.filter(
                        measurement => measurement.id !== operation.measurementId
                    );
                }
                break;
            }
            case 'set_option_order': {
                const order = new Map(operation.optionIds.map((id, index) => [id, index]));
                result = result
                    .map((option, index) => ({ option, index }))
                    .sort((left, right) => (
                        (order.get(left.option.id) ?? operation.optionIds.length + left.index)
                        - (order.get(right.option.id) ?? operation.optionIds.length + right.index)
                    ))
                    .map(item => item.option);
                break;
            }
            case 'set_measurement_order': {
                const option = result.find(candidate => candidate.id === operation.optionId);
                if (!option) break;
                const order = new Map(operation.measurementIds.map((id, index) => [id, index]));
                option.measurements = option.measurements
                    .map((measurement, index) => ({ measurement, index }))
                    .sort((left, right) => (
                        (order.get(left.measurement.id) ?? operation.measurementIds.length + left.index)
                        - (order.get(right.measurement.id) ?? operation.measurementIds.length + right.index)
                    ))
                    .map(item => item.measurement);
                break;
            }
        }
    }

    return result;
};

const optionNameKey = (option: ProposalOption): string => option.name.trim().toLocaleLowerCase('pt-BR');

const findMatchingOption = (option: ProposalOption, candidates: ProposalOption[]): ProposalOption | undefined => (
    candidates.find(candidate => candidate.id === option.id)
    ?? candidates.find(candidate => optionNameKey(candidate) === optionNameKey(option))
);

const conflictMeasurementId = (measurement: Measurement, usedIds: Set<number>): number => {
    const input = comparable(measurement);
    let hash = 2166136261;

    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    let candidate = -Math.max(1, hash >>> 0);
    while (usedIds.has(candidate)) {
        candidate -= 1;
    }
    return candidate;
};

const mergeMeasurements = (
    baseMeasurements: Measurement[],
    localMeasurements: Measurement[],
    remoteMeasurements: Measurement[]
): { measurements: Measurement[]; preservedConflicts: number } => {
    const baseById = new Map(baseMeasurements.map(measurement => [measurement.id, measurement]));
    const localById = new Map(localMeasurements.map(measurement => [measurement.id, measurement]));
    const remoteById = new Map(remoteMeasurements.map(measurement => [measurement.id, measurement]));
    const orderedIds = [
        ...localMeasurements.map(measurement => measurement.id),
        ...remoteMeasurements.map(measurement => measurement.id),
        ...baseMeasurements.map(measurement => measurement.id)
    ];
    const uniqueIds = [...new Set(orderedIds)];
    const usedIds = new Set(uniqueIds);
    const merged: Measurement[] = [];
    let preservedConflicts = 0;

    for (const id of uniqueIds) {
        const base = baseById.get(id);
        const local = localById.get(id);
        const remote = remoteById.get(id);

        if (!local && !remote) continue;

        if (!local) {
            if (base && remote && same(remote, base)) {
                // Exclusão local sobre uma versão remota que não mudou.
                continue;
            }
            if (remote) merged.push(remote);
            continue;
        }

        if (!remote) {
            if (base && same(local, base)) {
                // Exclusão remota sobre uma versão local que não mudou.
                continue;
            }
            merged.push(local);
            continue;
        }

        if (same(local, remote)) {
            merged.push(local);
            continue;
        }

        if (base && same(local, base)) {
            merged.push(remote);
            continue;
        }

        if (base && same(remote, base)) {
            merged.push(local);
            continue;
        }

        // Os dois aparelhos alteraram a mesma medida. Para nunca perder uma
        // coleta, preservamos as duas versões com IDs distintos. O histórico
        // remoto continua guardando as fotografias originais.
        merged.push(local);
        merged.push({
            ...remote,
            id: conflictMeasurementId(remote, usedIds),
            observation: remote.observation
                ? `${remote.observation} [Conflito preservado]`
                : '[Conflito preservado de outro aparelho]'
        });
        usedIds.add(merged[merged.length - 1].id);
        preservedConflicts += 1;
    }

    return { measurements: merged, preservedConflicts };
};

const mergeOption = (
    base: ProposalOption | undefined,
    local: ProposalOption | undefined,
    remote: ProposalOption | undefined
): { option?: ProposalOption; preservedConflicts: number } => {
    if (!local && !remote) return { preservedConflicts: 0 };

    if (!local) {
        if (base && remote && same(remote, base)) return { preservedConflicts: 0 };
        return { option: remote, preservedConflicts: 0 };
    }

    if (!remote) {
        if (base && same(local, base)) return { preservedConflicts: 0 };
        return { option: local, preservedConflicts: 0 };
    }

    const mergedMeasurements = mergeMeasurements(
        base?.measurements ?? [],
        local.measurements ?? [],
        remote.measurements ?? []
    );
    const localMetadata = { name: local.name, generalDiscount: local.generalDiscount };
    const remoteMetadata = { name: remote.name, generalDiscount: remote.generalDiscount };
    const baseMetadata = base
        ? { name: base.name, generalDiscount: base.generalDiscount }
        : undefined;
    const metadata = baseMetadata && same(localMetadata, baseMetadata)
        ? remoteMetadata
        : localMetadata;

    return {
        option: {
            ...remote,
            ...metadata,
            id: local.id,
            measurements: mergedMeasurements.measurements
        },
        preservedConflicts: mergedMeasurements.preservedConflicts
    };
};

export const mergeProposalOptions = (
    baseOptions: ProposalOption[],
    localOptions: ProposalOption[],
    remoteOptions: ProposalOption[]
): ProposalOptionsMergeResult => {
    const merged: ProposalOption[] = [];
    const handledLocal = new Set<ProposalOption>();
    const handledRemote = new Set<ProposalOption>();
    let preservedConflicts = 0;

    for (const base of baseOptions) {
        const local = findMatchingOption(base, localOptions);
        const remote = findMatchingOption(base, remoteOptions);
        if (local) handledLocal.add(local);
        if (remote) handledRemote.add(remote);

        const result = mergeOption(base, local, remote);
        if (result.option) merged.push(result.option);
        preservedConflicts += result.preservedConflicts;
    }

    for (const local of localOptions.filter(option => !handledLocal.has(option))) {
        const remote = findMatchingOption(
            local,
            remoteOptions.filter(option => !handledRemote.has(option))
        );
        handledLocal.add(local);
        if (remote) handledRemote.add(remote);

        const result = mergeOption(undefined, local, remote);
        if (result.option) merged.push(result.option);
        preservedConflicts += result.preservedConflicts;
    }

    for (const remote of remoteOptions.filter(option => !handledRemote.has(option))) {
        merged.push(remote);
    }

    return { options: merged, preservedConflicts };
};

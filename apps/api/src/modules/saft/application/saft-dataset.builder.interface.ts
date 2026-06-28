import type { ApplicationService } from '../../../shared-kernel';
import type { SaftDataset } from '../domain/models';

/** Assembles the normalized SAF-T-ready dataset for a company/month from existing sources. */
export interface ISaftDatasetBuilder extends ApplicationService {
  buildDataset(year: number, month: number): Promise<SaftDataset>;
}
export const SAFT_DATASET_BUILDER = Symbol('Saft.DatasetBuilder');

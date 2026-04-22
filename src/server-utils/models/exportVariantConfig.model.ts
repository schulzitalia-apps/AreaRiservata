import mongoose, { Model } from "mongoose";
import {
  buildExportVariantConfigSchema,
  type IExportVariantConfigDoc,
} from "./exportVariantConfig.schema";

declare global {
  // eslint-disable-next-line no-var
  var __EXPORT_VARIANT_CONFIG_MODELS__:
    | Map<string, Model<IExportVariantConfigDoc>>
    | undefined;
}

const cache = (global.__EXPORT_VARIANT_CONFIG_MODELS__ ||= new Map());

export function getExportVariantConfigModel(): Model<IExportVariantConfigDoc> {
  const modelName = "ExportVariantConfig_v1";

  if (cache.has(modelName)) return cache.get(modelName)!;

  const schema = buildExportVariantConfigSchema();

  const model =
    (mongoose.models[modelName] as Model<IExportVariantConfigDoc>) ||
    mongoose.model<IExportVariantConfigDoc>(
      modelName,
      schema,
      "export_variant_configs",
    );

  cache.set(modelName, model);
  return model;
}

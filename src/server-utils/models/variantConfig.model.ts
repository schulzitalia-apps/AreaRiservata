import mongoose, { Model } from "mongoose";
import {
  buildVariantConfigSchema,
  type IVariantConfigDoc,
} from "./variantConfig.schema";

declare global {
  // eslint-disable-next-line no-var
  var __VARIANT_CONFIG_MODELS__: Map<string, Model<IVariantConfigDoc>> | undefined;
}

const cache = (global.__VARIANT_CONFIG_MODELS__ ||= new Map());

export function getVariantConfigModel(): Model<IVariantConfigDoc> {
  const MODEL_NAME = "VariantConfig_v1";

  if (cache.has(MODEL_NAME)) return cache.get(MODEL_NAME)!;

  const schema = buildVariantConfigSchema();

  const model =
    (mongoose.models[MODEL_NAME] as Model<IVariantConfigDoc>) ||
    mongoose.model<IVariantConfigDoc>(MODEL_NAME, schema, "variant_configs");

  cache.set(MODEL_NAME, model);

  return model;
}

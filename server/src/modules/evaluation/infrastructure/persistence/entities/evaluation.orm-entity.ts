import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryColumn,
} from "typeorm";
import { ClassificationStepOrmEntity } from "./classification-step.orm-entity";
import { UploadSessionEntity } from "../../../../upload/infrastructure/persistence/entities/upload-session.orm-entity";
import type { EvaluationLotOrmEntity } from "./evaluation-lot.orm-entity";

type EvaluationType = "PLANT_ANALYSIS" | "FIELD_EVENT";
type ProviderKind = "own" | "third-party";
type TimeOfDay = "day" | "night";

/**
 * TypeORM entity for core.evaluations table.
 */
// biome-ignore format: true
@Entity({ schema: "core", name: "evaluations" })
@Index("idx_evaluations_type_timestamp", ["type", "creationTimestamp"])
@Index("idx_evaluations_truck_plate", ["truckPlate"])
@Index("idx_evaluations_upload_session_id", ["uploadSessionId"], { where: "upload_session_id IS NOT NULL" })
export class EvaluationOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ name: "upload_session_id", type: "uuid", nullable: true })
  uploadSessionId?: string | null;

  @ManyToOne(() => UploadSessionEntity, (s) => s.items, {
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "upload_session_id" })
  uploadSession?: UploadSessionEntity | null;

  @Column({
    name: "type",
    type: "enum",
    enum: ["PLANT_ANALYSIS", "FIELD_EVENT"],
    enumName: "evaluation_type",
    nullable: false,
  })
  type!: EvaluationType;

  @Column({ name: "creation_timestamp", type: "timestamptz", nullable: false })
  creationTimestamp!: Date;

  @Column({ name: "is_finalized", type: "boolean", nullable: false, default: false })
  isFinalized!: boolean;

  @Column({ name: "qr_code", type: "text", nullable: true })
  qrCode?: string | null;

  // NULL en FIELD_EVENT, 'own'/'third-party' en PLANT_ANALYSIS (la lógica se valida en DB)
  @Column({
    name: "provider_kind",
    type: "enum",
    enum: ["own", "third-party"],
    enumName: "provider_kind",
    nullable: true,
  })
  providerKind?: ProviderKind | null;

  @Column({ name: "truck_plate", type: "text", nullable: false })
  truckPlate!: string;

  @Column({ name: "consecutive_number", type: "text", nullable: false })
  consecutiveNumber!: string;

  @Column({ name: "provider_id", type: "uuid", nullable: true })
  providerId?: string | null;

  @Column({ name: "sub_provider_id", type: "uuid", nullable: true })
  subProviderId?: string | null;

  @Column({ name: "program_id", type: "uuid", nullable: true })
  programId?: string | null;

  @Column({ name: "lot_id", type: "uuid", nullable: true })
  lotId?: string | null;

  @Column({ name: "center_id", type: "uuid", nullable: true })
  centerId?: string | null;

  @Column({
    name: "device_time_of_day",
    type: "enum",
    enum: ["day", "night"],
    enumName: "time_of_day",
    nullable: false,
  })
  deviceTimeOfDay!: TimeOfDay;

  @Column({ name: "device_weather", type: "text", nullable: false })
  deviceWeather!: string;

  @Column({ name: "device_has_internet", type: "boolean", nullable: false })
  deviceHasInternet!: boolean;

  @Column({ name: "geo_latitude", type: "double precision", nullable: false })
  geoLatitude!: number;

  @Column({ name: "geo_longitude", type: "double precision", nullable: false })
  geoLongitude!: number;

  @Column({ name: "harvest_criteria_json", type: "jsonb", nullable: false })
  harvestCriteriaJson!: Record<string, unknown>;

  @Column({ name: "harvest_observation", type: "text", nullable: true })
  harvestObservation?: string | null;

  @Column({ name: "model_detection_id", type: "uuid", nullable: true })
  modelDetectionId?: string | null;

  @Column({ name: "model_external_id", type: "uuid", nullable: true })
  modelExternalId?: string | null;

  @Column({ name: "model_internal_id", type: "uuid", nullable: true })
  modelInternalId?: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @OneToMany("ClassificationStepOrmEntity", "evaluation", { cascade: ["insert"] })
  steps!: ClassificationStepOrmEntity[];

  // NUEVO: relación con evaluation_lots (colección de lotes asociados)
  @OneToMany("EvaluationLotOrmEntity", "evaluation", {
    cascade: ["insert"], // insertamos filas en la tabla puente al guardar la evaluación
    eager: false,
  })
  evaluationLots!: EvaluationLotOrmEntity[];
}

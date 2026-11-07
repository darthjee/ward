import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A member's role in an organization. Stored but **not enforced** (every member
 * can do every in-scope action), and distinct from Ward's global `User.isAdmin`.
 */
export const MembershipRole = {
  /** The organization's single owner — its creator. */
  OWNER: 'owner',
  /** Reserved for the future permission system. */
  ADMIN: 'admin',
  /** A regular member (future invited members join as `user`). */
  USER: 'user',
} as const;
export type MembershipRole = typeof MembershipRole[keyof typeof MembershipRole];

/**
 * A user's membership of an organization, with their role in it. Owns table
 * `auth_organization_memberships`; `organization_id` and `user_id` are real FKs
 * (to `auth_organizations` and `auth_users`, both owned by `auth`), declared in
 * the migration. At most one membership per `(organization, user)`.
 */
@Entity('auth_organization_memberships')
@Index('idx_auth_organization_memberships_organization_id_user_id', ['organizationId', 'userId'], { unique: true })
export class OrganizationMembership {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'organization_id', type: 'int' })
    organizationId!: number;

  @Index('idx_auth_organization_memberships_user_id')
  @Column({ name: 'user_id', type: 'int' })
    userId!: number;

  @Column({ type: 'varchar', length: 16 })
    role!: MembershipRole;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}

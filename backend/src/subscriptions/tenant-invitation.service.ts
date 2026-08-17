import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { TenantInvitation } from './tenant-invitation.entity';
import { Tenant } from '../tenants/tenant.entity';
import { TenantSubscription } from './tenant-subscription.entity';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { EmailService, SmtpConfig } from '../notifications/email.service';

@Injectable()
export class TenantInvitationService {
  constructor(
    @InjectRepository(TenantInvitation)
    private readonly invitations: Repository<TenantInvitation>,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(TenantSubscription)
    private readonly subscriptions: Repository<TenantSubscription>,
    private readonly settings: GlobalSettingsService,
    private readonly emailService: EmailService,
  ) {}

  async create(tenantId: string, email: string) {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const code = this.generateCode();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const invitation = this.invitations.create({
      tenantId,
      email,
      code,
      expiresAt,
    });
    const saved = await this.invitations.save(invitation);

    await this.sendInvitationEmail(tenant.name, email, code);

    return { id: saved.id, email, expiresAt: saved.expiresAt };
  }

  async verify(tenantId: string, code: string) {
    const invitation = await this.invitations.findOne({
      where: { tenantId, code, usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!invitation) throw new BadRequestException('Invalid or expired activation code');

    invitation.usedAt = new Date();
    await this.invitations.save(invitation);

    const sub = await this.subscriptions.findOne({ where: { tenantId } });
    if (sub && sub.status === 'pending') {
      sub.status = 'active';
      sub.activatedAt = new Date();
      await this.subscriptions.save(sub);
    }

    return { success: true, tenantId };
  }

  async resend(tenantId: string) {
    const invitation = await this.invitations.findOne({
      where: { tenantId, usedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!invitation) throw new NotFoundException('No pending invitation found');

    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const newCode = this.generateCode();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    invitation.code = newCode;
    invitation.expiresAt = expiresAt;
    await this.invitations.save(invitation);

    await this.sendInvitationEmail(tenant.name, invitation.email, newCode);

    return { success: true, email: invitation.email };
  }

  async findAll(tenantId?: string) {
    const qb = this.invitations.createQueryBuilder('i')
      .leftJoinAndSelect('i.tenant', 'tenant');
    if (tenantId) qb.andWhere('i.tenantId = :tenantId', { tenantId });
    return qb.orderBy('i.createdAt', 'DESC').getMany();
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async getSmtpConfig(): Promise<SmtpConfig | null> {
    const host = await this.settings.getValue('smtp.host');
    if (!host) return null;
    const port = parseInt(await this.settings.getValue('smtp.port') || '587', 10);
    const secure = (await this.settings.getValue('smtp.secure')) === 'true';
    const username = await this.settings.getValue('smtp.username') || '';
    const password = await this.settings.getValue('smtp.password') || '';
    const fromEmail = await this.settings.getValue('smtp.fromEmail') || '';
    const fromName = await this.settings.getValue('smtp.fromName') || 'MST-VTS';
    return { host, port, secure, username, password, fromEmail, fromName };
  }

  private async sendInvitationEmail(tenantName: string, email: string, code: string) {
    const config = await this.getSmtpConfig();
    if (!config) return;

    const contact = await this.settings.getContactDetails();
    const fromName = contact.name || 'MST-VTS';
    const subject = `MST-VTS: Verify your ${tenantName} account`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">Welcome to MST-VTS</h2>
        <p>Your account for <strong>${tenantName}</strong> has been created.</p>
        <p>Use the following activation code to verify your account:</p>
        <div style="background: #f4f4f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">${code}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This code expires in 48 hours.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">${fromName} &bull; ${contact.email || ''} ${contact.phone || ''}</p>
      </div>
    `;
    await this.emailService.send([email], subject, html, config);
  }
}

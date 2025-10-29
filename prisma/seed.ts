import { PrismaClient, UserType, Role, Permission, AccountStatus, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const salt = 10;
  const password = 'password';
  const hashPassword = await bcrypt.hash(password, salt);

  const permissionsData = [
    { slug: 'admin.create', description: 'Allows creating new admin' },
    {
      slug: 'admin.view_all',
      description: 'Allows fetching all admin records',
    },
    { slug: 'admin.view', description: 'Allows viewing admin details' },
    { slug: 'admin.update', description: 'Allows updating admin information' },
    { slug: 'admin.restore', description: 'Allows restoring deleted admin' },
    { slug: 'admin.soft_delete', description: 'Allows soft deleting of admin' },
    { slug: 'admin.delete', description: 'Allows deleting of admin' },

    { slug: 'user.view_all', description: 'Allows viewing all user details' },
    { slug: 'user.view', description: 'Allows viewing a single user details' },
    { slug: 'user.soft_delete', description: 'Allows soft deleting of user' },
    { slug: 'user.delete', description: 'Allows deleting of user' },

    { slug: 'role.create', description: 'Allows creating new roles' },
    { slug: 'role.view', description: 'Allows viewing role details' },
    { slug: 'role.update', description: 'Allows updating role information' },
    { slug: 'role.restore', description: 'Allows restoring deleted roles' },
    { slug: 'role.soft_delete', description: 'Allows soft deleting roles' },
    { slug: 'role.delete', description: 'Allows deleting roles' },
    {
      slug: 'permissions.assign',
      description: 'Allows assigning permissions to roles',
    },

    {
      slug: 'finance.view_all',
      description: 'Allows viewing all financial reports',
    },
    {
      slug: 'finance.view',
      description: 'Allows viewing a specific payment result',
    },
    {
      slug: 'finance.process_payment',
      description: 'Allows processing payments',
    },

    {
      slug: 'super_admin.full_access',
      description: 'Grants full system access to super admin',
    },
  ];

  const createdPermissions: { [slug: string]: Permission } = {};
  for (const p of permissionsData) {
    const permission = await prisma.permission.upsert({
      where: { slug: p.slug },
      update: { description: p.description },
      create: p,
    });
    createdPermissions[p.slug] = permission;
    console.log(`Upserted permission: ${permission.slug}`);
  }

  const allPermissions = Object.values(createdPermissions).map((p) => ({
    permission: { connect: { id: p.id } },
  }));

  // menu items with a view permission, so we'll add it to each.
  const sidebarItems = [
    {
      name: 'Dashboard',
      url: '/dashboard',
      icon: 'layout-dashboard',
      order: 1,
      permissionSlugs: ['admin.view_dashboard'],
    },
    {
      name: 'Wallets',
      url: '/wallets',
      icon: 'wallet',
      order: 2,
      permissionSlugs: ['admin.view_all', 'admin.view'],
    },
    {
      name: 'Virtual Cards',
      url: '/virtual-cards',
      icon: 'card',
      order: 3,
      permissionSlugs: ['finance.view_all', 'finance.view_one'],
      //   menuChild: [
      //     {
      //       name: 'Payments',
      //       url: '/finance/history',
      //       icon: 'history',
      //       order: 1,
      //       permissionSlugs: ['finance.view_all', 'finance.view_one'],
      //     },
      //     {
      //       name: 'Transfer',
      //       url: '/finance/transfer',
      //       icon: 'send',
      //       order: 2,
      //       permissionSlugs: ['finance.process_payment'],
      //     },
      //   ],
    },
    {
      name: 'Bill Payments',
      url: '/bill-payments',
      icon: 'bill',
      order: 4,
      permissionSlugs: ['finance.view'],
    },
    {
      name: 'Crypto',
      url: '/crypto',
      icon: 'cash',
      order: 5,
      permissionSlugs: ['finance.view'],
    },
    {
      name: 'Gift Cards',
      url: '/gift-cards',
      icon: 'cash',
      order: 6,
      permissionSlugs: ['finance.view'],
    },
    {
      name: 'Transactions',
      url: '/transactions',
      icon: 'transaction',
      order: 7,
      permissionSlugs: ['finance.view', 'finance.view_all'],
    },
    {
      name: 'Roles',
      url: '/roles',
      icon: 'users',
      order: 5,
      permissionSlugs: ['role.view_all', 'role.view'],
    },
    {
      name: 'Users',
      url: '/users',
      icon: 'users',
      order: 6,
      permissionSlugs: ['user.view_all', 'user.view'],
    },
    {
      name: 'Profile',
      url: '/profile',
      icon: 'user',
      order: 7,
      permissionSlugs: ['user.view_all', 'user.view'],
    },
    {
      name: 'Settings',
      url: '/settings',
      icon: 'gear',
      order: 8,
      permissionSlugs: ['user.view_all', 'user.view'],
    },
    {
      name: 'Audit Logs',
      url: '/audit-logs',
      icon: 'file-text',
      order: 9,
      permissionSlugs: ['super_admin.full_access'],
    },
    {
      name: 'Log Out',
      url: '/logout',
      icon: 'log-out',
      order: 10,
      permissionSlugs: ['admin.view_dashboard'],
    },
  ];

  //   setting up roles and assigning permissions

  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {
      permissions: {
        deleteMany: {},
        create: allPermissions,
      },
    },
    create: {
      name: 'SUPER_ADMIN',
      slug: 'super_admin',
      description: 'Full administrative access',
      permissions: { create: allPermissions },
    },
    include: { permissions: true },
  });
  console.log(
    `Upserted role: ${superAdminRole.name} with ${superAdminRole.permissions.length} permissions.`,
  );

  const supportAdminPermissions = [
    createdPermissions['admin.create'],
    createdPermissions['admin.update'],
    createdPermissions['admin.view_all'],
    createdPermissions['admin.view'],
    createdPermissions['admin.soft_delete'],
    createdPermissions['admin.restore'],
    createdPermissions['admin.delete'],
  ].map((p) => ({ permission: { connect: { id: p.id } } }));

  const supportAdmin = await prisma.role.upsert({
    where: { name: 'SUPPORT ADMIN' },
    update: {
      permissions: {
        deleteMany: {},
        create: supportAdminPermissions,
      },
    },
    create: {
      name: 'SUPPORT ADMIN',
      slug: 'support_admin',
      description: 'Support administrative access',
      permissions: { create: supportAdminPermissions },
    },
    include: { permissions: true },
  });
  console.log(
    `Upserted role: ${supportAdmin.name} with ${supportAdmin.permissions.length} permissions.`,
  );

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin-whitelist@yopmail.com' },
    update: { roleId: supportAdmin.id },
    create: {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin-whitelist@yopmail.com',
      password: hashPassword,
      phoneNumber: '08123456789',
      userType: UserType.ADMIN,
      status: AccountStatus.ACTIVE,
      isVerified: true,
      role: { connect: { id: superAdminRole.id } },
      gender: Gender.MALE,
      dob: new Date('1995-06-17T08:57:21.026Z'),
    },
  });
  console.log(
    `Upserted user: ${superAdmin.email} with role ${superAdminRole.name}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

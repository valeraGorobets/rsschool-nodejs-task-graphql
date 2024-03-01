import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { createGqlResponseSchema, gqlResponseSchema } from './schemas.js';
import { buildSchema, graphql } from 'graphql';
import { Prisma, PrismaClient } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library.js';
import { MemberTypeId } from "../member-types/schemas.js";

const schema = buildSchema(`
  enum MemberTypeId {
    ${ Object.values(MemberTypeId).join(' ') }
  }
  
  scalar UUID

  type MemberType {
    id: MemberTypeId
    discount: Float
    postsLimitPerMonth: Int
  }

  type Post {
    id: UUID
    title: String
    content: String
    authorId: Int
  }

  type User {
    id: UUID
    name: String
    balance: Float
    profile(id: UUID): Profile
    posts: [Post]
    userSubscribedTo(id: UUID): [User]
    subscribedToUser(id: UUID): [User]
  }

  type Profile {
    id: UUID
    isMale: Boolean
    yearOfBirth: Int
    userId: Int
    memberTypeId: Int
    memberType(memberTypeId: UUID): MemberType
  }

  type Query {
    memberTypes: [MemberType]
    memberType(id: MemberTypeId!): MemberType
    posts: [Post]
    post(id: UUID): Post
    users: [User]
    user(id: UUID): User
    profiles: [Profile]
    profile(id: UUID): Profile
  }

  schema {
    query: Query
  }
`);

const buildRes = (prisma: PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>) => {
	return {
		memberTypes: async () => {
			return prisma.memberType.findMany();
		},
		memberType: async ({ id }) => {
			return prisma.memberType.findUnique({
				where: {
					id: id as MemberTypeId,
				}
			});
		},
		posts: async () => {
			return prisma.post.findMany();
		},
		post: async ({ id }) => {
			return prisma.post.findUnique({
				where: {
					id: id as string,
				}
			});
		},
		users: async () => {
			return prisma.user.findMany({
				include: {
					profile: {
						include: {
							memberType: true,
						},
					},
					posts: true,
				},
			});
		},
		user: async ({ id }) => {
			return prisma.user.findUnique({
				where: {
					id: id as string,
				},
				include: {
					profile: {
						include: {
							memberType: true,
						},
					},
					posts: true,
					userSubscribedTo: true,
					subscribedToUser: true,
				},
			});
		},
		userSubscribedTo: async ({ id }) => {
			return prisma.user.findMany({
				where: {
					userSubscribedTo: {
						some: {
							authorId: id as string,
						},
					},
				},
			});
		},
		subscribedToUser: async ({ id }) => {
			return prisma.user.findMany({
				where: {
					subscribedToUser: {
						some: {
							subscriberId: id as string,
						},
					},
				},
			});
		},
		profiles: async () => {
			return prisma.profile.findMany();
		},
		profile: async ({ id }) => {
			return prisma.profile.findUnique({
				where: {
					id: id as string,
				},
			});
		},
	};
}

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
	const { prisma } = fastify;
	fastify.route({
		url: '/',
		method: 'POST',
		schema: {
			...createGqlResponseSchema,
			response: {
				200: gqlResponseSchema,
			},
		},
		async handler(request) {
			const { query, variables } = request.body;

			const result = await graphql({
				schema,
				source: query,
				rootValue: buildRes(prisma),
				contextValue: request.routeOptions.config,
				variableValues: variables
			});
			return result;
		},
	});
};

export default plugin;

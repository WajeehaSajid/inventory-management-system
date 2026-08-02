// Static OpenAPI 3.0 specification for the Inventory Management API.
// Served via swagger-ui-express at GET /api-docs (interactive UI)
// and GET /api-docs.json (raw spec, importable into Postman).

const errorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string', example: 'name: is required' },
      },
    },
  },
};

const paginationSchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', example: 1 },
    pageSize: { type: 'integer', example: 10 },
    total: { type: 'integer', example: 42 },
    totalPages: { type: 'integer', example: 5 },
  },
};

const categorySchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    description: { type: 'string', nullable: true },
  },
};

const supplierSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    contact_email: { type: 'string' },
    phone: { type: 'string', nullable: true },
    address: { type: 'string', nullable: true },
  },
};

const productSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    sku: { type: 'string' },
    description: { type: 'string', nullable: true },
    unit_price: { type: 'string', example: '1200.00' },
    quantity_in_stock: { type: 'integer' },
    category_id: { type: 'integer', nullable: true },
    supplier_id: { type: 'integer', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
};

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    email: { type: 'string' },
    role: { type: 'string', enum: ['admin', 'staff'] },
  },
};

function crudPaths(resource, schema, extraDeleteNote = '') {
  const tag = resource.charAt(0).toUpperCase() + resource.slice(1);
  return {
    [`/api/${resource}`]: {
      get: {
        tags: [tag],
        summary: `List ${resource}`,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: {
            description: 'Paginated list',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: schema }, pagination: paginationSchema } } } },
          },
        },
      },
      post: {
        tags: [tag],
        summary: `Create a ${resource.slice(0, -1)}`,
        requestBody: { required: true, content: { 'application/json': { schema } } },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { type: 'object', properties: { data: schema } } } } },
          422: { description: 'Validation error', content: { 'application/json': { schema: errorSchema } } },
          409: { description: 'Conflict (duplicate)', content: { 'application/json': { schema: errorSchema } } },
        },
      },
    },
    [`/api/${resource}/{id}`]: {
      get: {
        tags: [tag],
        summary: `Get a single ${resource.slice(0, -1)}`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not found', content: { 'application/json': { schema: errorSchema } } } },
      },
      put: {
        tags: [tag],
        summary: `Update a ${resource.slice(0, -1)}`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema } } },
        responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
      },
      delete: {
        tags: [tag],
        summary: `Delete a ${resource.slice(0, -1)} (admin only)${extraDeleteNote}`,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          204: { description: 'Deleted' },
          403: { description: 'Forbidden — admin role required', content: { 'application/json': { schema: errorSchema } } },
          409: { description: 'Still referenced by products', content: { 'application/json': { schema: errorSchema } } },
        },
      },
    },
  };
}

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Inventory Management API',
    version: '1.0.0',
    description: 'REST API for the Product Inventory Management System — products, categories, suppliers, stock movements, authentication, and dashboard analytics.',
  },
  servers: [
    { url: '/api', description: 'Relative to wherever this API is deployed' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth', description: 'Login, signup, and session' },
    { name: 'Categories' },
    { name: 'Suppliers' },
    { name: 'Products' },
    { name: 'Stock Movements' },
    { name: 'Dashboard', description: 'Analytics for the summary/charts view' },
  ],
  paths: {
    '/api/health': {
      get: { tags: ['Auth'], summary: 'Health check', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Sign up (creates a "staff" account)', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' } } } } } },
        responses: { 201: { description: 'Account created + token', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object', properties: { user: userSchema, token: { type: 'string' } } } } } } } } },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Log in', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' } } } } } },
        responses: {
          200: { description: 'Token + user', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object', properties: { user: userSchema, token: { type: 'string' } } } } } } } },
          401: { description: 'Incorrect email or password', content: { 'application/json': { schema: errorSchema } } },
        },
      },
    },
    '/api/auth/me': {
      get: { tags: ['Auth'], summary: 'Get the current logged-in user', responses: { 200: { description: 'Current user' }, 401: { description: 'Not logged in' } } },
    },

    ...crudPaths('categories', categorySchema, ' — blocked if products still reference it'),
    ...crudPaths('suppliers', supplierSchema, ' — blocked if products still reference it'),

    '/api/products': {
      get: {
        tags: ['Products'], summary: 'List products (search, filter, paginate)',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Matches name or SKU' },
          { name: 'category', in: 'query', schema: { type: 'integer' } },
          { name: 'supplier', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['in_stock', 'low_stock', 'out_of_stock'] } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Paginated list' } },
      },
      post: {
        tags: ['Products'], summary: 'Create a product',
        requestBody: { required: true, content: { 'application/json': { schema: productSchema } } },
        responses: { 201: { description: 'Created' }, 409: { description: 'Duplicate SKU' }, 422: { description: 'Validation error' } },
      },
    },
    '/api/products/{id}': {
      get: { tags: ['Products'], summary: 'Get a single product', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } } },
      put: { tags: ['Products'], summary: 'Update a product', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], requestBody: { content: { 'application/json': { schema: productSchema } } }, responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Products'], summary: 'Delete a product (admin only)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 204: { description: 'Deleted' }, 403: { description: 'Forbidden' } } },
    },
    '/api/products/export': {
      get: { tags: ['Products'], summary: 'Download all products as CSV', responses: { 200: { description: 'CSV file', content: { 'text/csv': {} } } } },
    },
    '/api/products/import': {
      post: {
        tags: ['Products'], summary: 'Bulk-import products from CSV (admin only)',
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } },
        responses: { 200: { description: 'Import summary: created / updated / errors' }, 403: { description: 'Forbidden — admin role required' } },
      },
    },
    '/api/products/{id}/stock-movements': {
      get: { tags: ['Stock Movements'], summary: 'Movement history for a product', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'List of movements' } } },
      post: {
        tags: ['Stock Movements'], summary: 'Record a stock IN/OUT movement (atomic)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string', enum: ['IN', 'OUT'] }, quantity: { type: 'integer' }, reason: { type: 'string' } } } } } },
        responses: { 201: { description: 'Movement recorded, product quantity updated' }, 422: { description: 'Insufficient stock for an OUT movement' } },
      },
    },

    '/api/dashboard/summary': {
      get: { tags: ['Dashboard'], summary: 'Top-level counts and stock status breakdown', responses: { 200: { description: 'Summary stats' } } },
    },
    '/api/dashboard/stock-trend': {
      get: { tags: ['Dashboard'], summary: 'Daily IN/OUT totals for a line chart', parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', default: 7 } }], responses: { 200: { description: 'Daily trend data' } } },
    },
    '/api/dashboard/category-breakdown': {
      get: { tags: ['Dashboard'], summary: 'Product count per category, for a pie chart', responses: { 200: { description: 'Category breakdown' } } },
    },
    '/api/dashboard/top-products': {
      get: { tags: ['Dashboard'], summary: 'Highest inventory-value products', parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 5 } }], responses: { 200: { description: 'Top products' } } },
    },
  },
};

module.exports = swaggerSpec;

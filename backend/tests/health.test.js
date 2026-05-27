import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';

describe('Health and System Checks', () => {
  it('GET / should return health check', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'success');
  });

  afterAll(async () => {
    // Close the mongoose connection to allow Jest to exit successfully.
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
});

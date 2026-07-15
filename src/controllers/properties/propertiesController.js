const prisma = require('../../lib/prisma');

const getSocieties = async (req, res) => {
  try {
    const societies = await prisma.societies.findMany({
      where: { is_active: true },
      select: { society_id: true, society_name: true }
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success', data: societies }));
  } catch (error) {
    console.error('[GET_SOCIETIES_ERROR]', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Failed to fetch societies.' }));
  }
};

const getTowers = async (req, res, query) => {
  try {
    const societyId = parseInt(query.get('societyId'));
    if (!societyId) {
      return res.end(JSON.stringify({ status: 'error', message: 'societyId is required.' }));
    }
    const towers = await prisma.towers.findMany({
      where: { society_id: societyId, is_active: true },
      select: { tower_id: true, tower_name: true }
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success', data: towers }));
  } catch (error) {
    console.error('[GET_TOWERS_ERROR]', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Failed to fetch towers.' }));
  }
};

const getFloors = async (req, res, query) => {
  try {
    const towerId = parseInt(query.get('towerId'));
    if (!towerId) {
      return res.end(JSON.stringify({ status: 'error', message: 'towerId is required.' }));
    }
    const floors = await prisma.floors.findMany({
      where: { tower_id: towerId },
      select: { floor_id: true, floor_number: true },
      orderBy: { floor_number: 'asc' }
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success', data: floors }));
  } catch (error) {
    console.error('[GET_FLOORS_ERROR]', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Failed to fetch floors.' }));
  }
};

const getFlats = async (req, res, query) => {
  try {
    const floorId = parseInt(query.get('floorId'));
    if (!floorId) {
      return res.end(JSON.stringify({ status: 'error', message: 'floorId is required.' }));
    }
    const flats = await prisma.flats.findMany({
      where: { floor_id: floorId },
      select: { flat_id: true, flat_number: true }
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'success', data: flats }));
  } catch (error) {
    console.error('[GET_FLATS_ERROR]', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Failed to fetch flats.' }));
  }
};

module.exports = { getSocieties, getTowers, getFloors, getFlats };

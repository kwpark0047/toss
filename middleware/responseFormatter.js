const responseFormatter = (req, res, next) => {
  // Success response method (default 200)
  res.success = (data, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json({
      success: true,
      status: 'success',
      message,
      data
    });
  };

  // 201 Created (POST)
  res.created = (data, message = 'Created') => {
    res.status(201).json({
      success: true,
      status: 'success',
      message,
      data
    });
  };

  // 200 Updated (PUT/PATCH)
  res.updated = (data, message = 'Updated') => {
    res.status(200).json({
      success: true,
      status: 'success',
      message,
      data
    });
  };

  // 204 No Content (DELETE / successful mutation with no body)
  res.noContent = () => {
    res.status(204).end();
  };

  // Pagination response method
  res.paginated = (data, pagination, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json({
      success: true,
      status: 'success',
      message,
      data: data,
      pagination: {
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(pagination.total / pagination.limit)
      }
    });
  };

  next();
};

module.exports = responseFormatter;

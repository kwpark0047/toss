const responseFormatter = (req, res, next) => {
  // Success response method
  res.success = (data, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json({
      success: true,
      status: 'success',
      message,
      data
    });
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

import Review from '../models/Review.js';
import College from '../models/College.js';

/**
 * Add a review for a college.
 */
export async function addReview(req, res) {
  try {
    const { collegeId, rating, review } = req.body;
    const userId = req.user._id;

    if (!collegeId || !rating || !review) {
      return res.status(400).json({ message: 'College ID, rating, and review content are required.' });
    }

    // Check if the user already reviewed this college
    const existingReview = await Review.findOne({ userId, collegeId });
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this college.' });
    }

    const newReview = new Review({
      userId,
      collegeId,
      rating,
      review
    });

    await newReview.save();

    // Associate review with the college
    await College.findByIdAndUpdate(collegeId, {
      $push: { reviews: newReview._id }
    });

    // Populate user info for returning the response
    const populatedReview = await Review.findById(newReview._id).populate('userId', 'name');

    return res.status(201).json({
      message: 'Review submitted successfully',
      review: populatedReview
    });
  } catch (error) {
    console.error('Error in addReview:', error);
    return res.status(500).json({ message: 'Failed to submit review', error: error.message });
  }
}

/**
 * Toggle upvote for a review.
 */
export async function upvoteReview(req, res) {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const upvoteIndex = review.upvotes.indexOf(userId);
    if (upvoteIndex > -1) {
      // Already upvoted, remove upvote
      review.upvotes.splice(upvoteIndex, 1);
    } else {
      // Add upvote
      review.upvotes.push(userId);
    }

    await review.save();

    return res.json({
      message: 'Upvote updated',
      upvotesCount: review.upvotes.length,
      upvoted: upvoteIndex === -1 // true if just upvoted
    });
  } catch (error) {
    console.error('Error in upvoteReview:', error);
    return res.status(500).json({ message: 'Failed to upvote review' });
  }
}

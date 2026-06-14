import unittest
from src.utils import is_valid_url, normalize_url, is_allowed_image_url, get_filename_from_url

class TestUtils(unittest.TestCase):
    def test_is_valid_url(self):
        self.assertTrue(is_valid_url("http://example.com"))
        self.assertTrue(is_valid_url("https://example.com/path"))
        self.assertFalse(is_valid_url("not a url"))
        self.assertFalse(is_valid_url("http://"))
        self.assertFalse(is_valid_url("https://"))

    def test_normalize_url(self):
        self.assertEqual(normalize_url("http://example.com/path#fragment"), "http://example.com/path")
        self.assertEqual(normalize_url("https://example.com/path?query=value#frag"), "https://example.com/path?query=value")

    def test_is_allowed_image_url(self):
        allowed_formats = ['jpg', 'jpeg', 'png', 'webp']
        skip_keywords = ['thumb', 'thumbnail', 'small', 'lowres']
        # Allowed URLs
        self.assertTrue(is_allowed_image_url("http://example.com/image.jpg", allowed_formats, skip_keywords))
        self.assertTrue(is_allowed_image_url("http://example.com/image.jpeg", allowed_formats, skip_keywords))
        self.assertTrue(is_allowed_image_url("http://example.com/image.png", allowed_formats, skip_keywords))
        self.assertTrue(is_allowed_image_url("http://example.com/image.webp", allowed_formats, skip_keywords))
        # Disallowed by extension
        self.assertFalse(is_allowed_image_url("http://example.com/image.gif", allowed_formats, skip_keywords))
        self.assertFalse(is_allowed_image_url("http://example.com/image.txt", allowed_formats, skip_keywords))
        # Disallowed by skip keywords
        self.assertFalse(is_allowed_image_url("http://example.com/thumb.jpg", allowed_formats, skip_keywords))
        self.assertFalse(is_allowed_image_url("http://example.com/image.thumbnail.png", allowed_formats, skip_keywords))
        self.assertFalse(is_allowed_image_url("http://example.com/small.webp", allowed_formats, skip_keywords))
        self.assertFalse(is_allowed_image_url("http://example.com/image_lowres.jpg", allowed_formats, skip_keywords))

    def test_get_filename_from_url(self):
        self.assertEqual(get_filename_from_url("http://example.com/path/image.jpg"), "image.jpg")
        self.assertEqual(get_filename_from_url("http://example.com/path/"), "image.jpg")  # default when no filename
        self.assertEqual(get_filename_from_url("http://example.com"), "image.jpg")  # default when no filename

if __name__ == '__main__':
    unittest.main()
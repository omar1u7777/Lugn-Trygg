// AI-powered name extraction and formatting utilities

/**
 * Intelligently extracts and formats a display name from an email address
 * @param email - The email address to extract name from
 * @returns A formatted display name
 */
export const extractDisplayName = (email: string): string => {
  if (!email) return "Användare";

  // Extract username part before @
  const username = email.split('@')[0] || email;

  // Handle underscores first (convert to spaces)
  let processedUsername = username;
  if (processedUsername.includes('_')) {
    // Split by underscore and capitalize each part
    const underscoreParts = processedUsername.split('_').filter(part => part.length > 0);
    if (underscoreParts.length >= 2) {
      return underscoreParts.slice(0, 2).map(part =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join(' ');
    }
    processedUsername = underscoreParts[0] || processedUsername;
  }

  // Remove all numbers and special characters except dots, keep only letters and dots
  const cleanedUsername = processedUsername.replace(/[^a-zA-Z.]/g, '');

  // Split by dots and filter out empty parts and parts without letters
  const parts = cleanedUsername.split('.').filter(part => part.length > 0 && /[a-zA-Z]/.test(part));

  // Take only the first two parts (first name and last name)
  const nameParts = parts.slice(0, 2);

  if (nameParts.length === 2) {
    // Capitalize both first and last name
    return nameParts.map(part =>
      part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    ).join(' ');
  } else if (nameParts.length === 1 && nameParts[0]) {
    // Only one name part
    return nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1).toLowerCase();
  }

  // Fallback: if no valid parts found, use cleaned version
  const fallbackName = cleanedUsername.replace(/[^a-zA-Z]/g, '');
  if (fallbackName.length > 0) {
    return fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1).toLowerCase();
  }

  return "Användare";
};

/**
 * Test examples of the name extraction
 */
export const testNameExtraction = () => {
  const examples = [
    "marah.ghaleb.12@gmail.com",     // Should become "Marah Ghaleb"
    "john.doe@gmail.com",            // Should become "John Doe"
    "mary.jane.smith@outlook.com",   // Should become "Mary Jane"
    "user123@gmail.com",             // Should become "User"
    "test_user@domain.com",          // Should become "Test User"
    "simple@gmail.com",              // Should become "Simple"
  ];

  return examples.map(email => ({
    email,
    extracted: extractDisplayName(email)
  }));
};
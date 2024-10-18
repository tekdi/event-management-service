import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

function validateMeetingUrl(url, provider) {
  const providerPatterns = {
    zoom: /^https?:\/\/[\w-]*\.?zoom\.(com|us)\/(j|my)\/[-\w?=]+(?:\?.*)?$/,
    googlemeet:
      /^https?:\/\/meet\.(google\.com|[a-zA-Z0-9-]+\.com)\/[a-z]{3,}-[a-z]{3,}-[a-z]{3}(\?[\w=&-]*)?$/,
    // microsoftteams: /^(https:\/\/)?teams\.microsoft\.com\/[a-zA-Z0-9?&=]+$/,
    // Add other supported providers as needed
  };
  if (
    !url ||
    typeof url !== 'string' ||
    !provider ||
    typeof provider !== 'string'
  ) {
    return false;
  }

  const pattern = providerPatterns[provider.toLowerCase()];
  if (!pattern) {
    return false; // Unsupported provider
  }

  return pattern.test(url);
}

@ValidatorConstraint({ name: 'urlWithProviderValidator', async: false })
export class UrlWithProviderValidator implements ValidatorConstraintInterface {
  validate(url: string, args: ValidationArguments) {
    const { onlineProvider } = args.object as any;
    return validateMeetingUrl(url, onlineProvider);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Invalid meeting URL for the specified provider!';
  }
}

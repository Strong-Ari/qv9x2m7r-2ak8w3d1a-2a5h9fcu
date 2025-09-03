declare module "*.tsx" {
  const content: any;
  export default content;
}

declare module "resend" {
  export class Resend {
    constructor(apiKey: string);
    emails: {
      send(options: {
        from: string;
        to: string;
        subject: string;
        html: string;
      }): Promise<any>;
    };
  }
}

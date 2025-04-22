const AWS = require('aws-sdk');
const sharp = require('sharp');

const s3 = new AWS.S3();
const DESTINATION_BUCKET = 'hirely-job-image-bucket-processed';

exports.handler = async (event) => {
    try {
        // Get the source bucket and key from the S3 event
        const sourceBucket = event.Records[0].s3.bucket.name;
        const sourceKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
        
        // Skip if it's from the processed bucket
        if (sourceBucket === DESTINATION_BUCKET) {
            console.log('Skipping - image from processed bucket');
            return;
        }

        // Get the image from S3
        const inputParams = {
            Bucket: sourceBucket,
            Key: sourceKey
        };
        
        const inputImage = await s3.getObject(inputParams).promise();
        
        // Process the image with Sharp
        let processedImage = sharp(inputImage.Body);
        
        // Resize and compress
        const buffer = await processedImage
            .resize(800, null, { // Max width 800px, height auto
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({
                quality: 80,
                mozjpeg: true
            })
            .toBuffer();

        // Upload the processed image to the processed bucket
        await s3.putObject({
            Bucket: DESTINATION_BUCKET,
            Key: sourceKey, // Using same key as original
            Body: buffer,
            ContentType: 'image/jpeg',
            Metadata: {
                'original-size': inputImage.ContentLength.toString(),
                'processed-size': buffer.length.toString()
            }
        }).promise();

        console.log(`Successfully processed ${sourceKey}`);
        console.log(`From bucket: ${sourceBucket}`);
        console.log(`To bucket: ${DESTINATION_BUCKET}`);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Image processed successfully'
            })
        };
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
}